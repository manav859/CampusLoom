/**
 * One-off repair for teacher timetable conflicts.
 *
 * Until ensureTeacherPeriods was changed to seed free periods, every new slot
 * was handed a class by a per-teacher round robin that never looked at what
 * the other teachers already held. Two teachers routinely ended up owning the
 * same class in the same day and period. The web grid refuses to save while
 * any such clash is on screen, so a principal could be locked out of their own
 * timetable until every one was cleared by hand.
 *
 * This finds each contested slot and blanks all but one holder, leaving the
 * losers as free periods for the principal to fill in. It never deletes a row
 * and never touches a slot only one teacher holds.
 *
 * Which holder is kept, in order:
 *   1. the teacher who actually owns the subject (subjects.teacherId), since
 *      that is the assignment the rest of the app already treats as real;
 *   2. failing that, the oldest row, which is the closest thing to the one a
 *      human most likely created first.
 *
 * Usage — dry run first, it is the default and writes nothing:
 *   DATABASE_URL=postgresql://... npx tsx scripts/fix-period-conflicts.ts
 *   DATABASE_URL=postgresql://... npx tsx scripts/fix-period-conflicts.ts --apply
 *
 * --apply always writes an undo file first (default undo-period-conflicts.json,
 * override with --out <file>). Nothing is cleared unless that file is safely on
 * disk. To put every cleared assignment back exactly as it was:
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/fix-period-conflicts.ts --undo undo-period-conflicts.json
 *
 * Pass --school <schoolId> to limit it to one school.
 *
 * NOTE: DATABASE_URL must be set on the command line. backend/.env points at
 * production, and dotenv does not override a variable already in the
 * environment — so the prefix above is what decides the target. The script
 * prints the host it is about to touch and refuses to run without one.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const arg = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const apply = process.argv.includes("--apply");
const onlySchool = arg("--school");
const undoFile = arg("--undo");
const outFile = arg("--out") ?? "undo-period-conflicts.json";

type UndoEntry = { id: string; classId: string | null; subjectId: string | null };

if (!process.env.DATABASE_URL) {
  console.error("Refusing to run: set DATABASE_URL explicitly, e.g.\n  DATABASE_URL=postgresql://... npx tsx scripts/fix-period-conflicts.ts");
  process.exit(1);
}

const prisma = new PrismaClient();

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
}

/// Puts back exactly what a previous --apply cleared.
async function undo(file: string) {
  const entries = JSON.parse(readFileSync(file, "utf8")) as UndoEntry[];
  console.log(`Restoring ${entries.length} assignment(s) from ${file}`);
  let restored = 0;
  for (const entry of entries) {
    await prisma.teacherPeriodAssignment.update({
      where: { id: entry.id },
      data: { classId: entry.classId, subjectId: entry.subjectId }
    });
    restored += 1;
  }
  console.log(`Restored ${restored} assignment(s).`);
}

async function main() {
  console.log(`Target database : ${hostOf(process.env.DATABASE_URL!)}`);
  console.log(`Mode            : ${undoFile ? "UNDO (writes)" : apply ? "APPLY (writes)" : "dry run (no writes)"}`);
  if (onlySchool) console.log(`School          : ${onlySchool}`);
  console.log("");

  if (undoFile) {
    await undo(undoFile);
    return;
  }

  // Which schools live in this database, so a stale or demo copy is obvious
  // before anything is written to it.
  const schools = await prisma.school.findMany({ select: { id: true, name: true, code: true } });
  console.log(`Schools in this database (${schools.length}):`);
  for (const school of schools) console.log(`   ${school.code}  ${school.name}`);
  console.log("");

  const rows = await prisma.teacherPeriodAssignment.findMany({
    where: { classId: { not: null }, ...(onlySchool ? { schoolId: onlySchool } : {}) },
    select: {
      id: true,
      schoolId: true,
      teacherId: true,
      dayOfWeek: true,
      periodNumber: true,
      classId: true,
      subjectId: true,
      createdAt: true,
      teacher: { select: { fullName: true } },
      class: { select: { name: true, section: true } },
      subject: { select: { name: true, teacherId: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  // A slot is contested when more than one teacher holds the same class in the
  // same school, on the same day, at the same period.
  const slots = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.schoolId}|${row.dayOfWeek}|${row.periodNumber}|${row.classId}`;
    const bucket = slots.get(key);
    if (bucket) bucket.push(row);
    else slots.set(key, [row]);
  }

  const contested = [...slots.values()].filter((bucket) => bucket.length > 1);
  if (contested.length === 0) {
    console.log("No contested slots. Nothing to do.");
    return;
  }

  const schoolName = new Map(schools.map((school) => [school.id, `${school.code} ${school.name}`]));
  const perSchool = new Map<string, number>();
  const losers: UndoEntry[] = [];
  const detailLimit = 15;

  contested.forEach((bucket, index) => {
    const keeper = bucket.find((row) => row.subject?.teacherId === row.teacherId) ?? bucket[0];
    const first = bucket[0];
    const className = first.class ? `${first.class.name}-${first.class.section}` : first.classId;
    const reason = keeper.subject?.teacherId === keeper.teacherId ? "owns the subject" : "oldest row";
    const verbose = index < detailLimit;

    if (verbose) console.log(`${className}  ${first.dayOfWeek} period ${first.periodNumber}`);
    for (const row of bucket) {
      const kept = row.id === keeper.id;
      if (verbose) console.log(`   ${kept ? "KEEP " : "clear"}  ${row.teacher.fullName}${kept ? `  (${reason})` : ""}`);
      if (!kept) {
        losers.push({ id: row.id, classId: row.classId, subjectId: row.subjectId });
        perSchool.set(row.schoolId, (perSchool.get(row.schoolId) ?? 0) + 1);
      }
    }
    if (verbose) console.log("");
  });

  if (contested.length > detailLimit) {
    console.log(`... and ${contested.length - detailLimit} more contested slot(s) not listed.\n`);
  }

  console.log("Assignments that would be cleared, by school:");
  for (const [schoolId, count] of [...perSchool].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${count.toString().padStart(5)}  ${schoolName.get(schoolId) ?? schoolId}`);
  }
  console.log("");
  console.log(`${contested.length} contested slot(s); ${losers.length} assignment(s) would become free periods.`);

  if (!apply) {
    console.log("\nDry run — nothing was written. Re-run with --apply to make these changes.");
    return;
  }

  // The undo file is written and flushed before a single row changes, so a
  // crash mid-apply still leaves a complete record of what to put back.
  writeFileSync(outFile, JSON.stringify(losers, null, 2), "utf8");
  console.log(`\nUndo file written: ${outFile} (${losers.length} assignment(s))`);

  const result = await prisma.teacherPeriodAssignment.updateMany({
    where: { id: { in: losers.map((entry) => entry.id) } },
    data: { classId: null, subjectId: null }
  });
  console.log(`Applied: ${result.count} assignment(s) cleared to free periods.`);
  console.log(`\nTo reverse this exactly:\n  npx tsx scripts/fix-period-conflicts.ts --undo ${outFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
