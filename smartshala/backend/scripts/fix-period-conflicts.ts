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
 * Pass --school <schoolId> to limit it to one school.
 *
 * NOTE: DATABASE_URL must be set on the command line. backend/.env points at
 * production, and dotenv does not override a variable already in the
 * environment — so the prefix above is what decides the target. The script
 * prints the host it is about to touch and refuses to run without one.
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const schoolArg = process.argv.indexOf("--school");
const onlySchool = schoolArg === -1 ? undefined : process.argv[schoolArg + 1];

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

async function main() {
  console.log(`Target database : ${hostOf(process.env.DATABASE_URL!)}`);
  console.log(`Mode            : ${apply ? "APPLY (writes)" : "dry run (no writes)"}`);
  if (onlySchool) console.log(`School          : ${onlySchool}`);
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

  const losers: string[] = [];
  for (const bucket of contested) {
    const keeper = bucket.find((row) => row.subject?.teacherId === row.teacherId) ?? bucket[0];
    const first = bucket[0];
    const className = first.class ? `${first.class.name}-${first.class.section}` : first.classId;
    const reason = keeper.subject?.teacherId === keeper.teacherId ? "owns the subject" : "oldest row";

    console.log(`${className}  ${first.dayOfWeek} period ${first.periodNumber}`);
    for (const row of bucket) {
      const kept = row.id === keeper.id;
      console.log(`   ${kept ? "KEEP " : "clear"}  ${row.teacher.fullName}${kept ? `  (${reason})` : ""}`);
      if (!kept) losers.push(row.id);
    }
    console.log("");
  }

  console.log(`${contested.length} contested slot(s); ${losers.length} assignment(s) would become free periods.`);

  if (!apply) {
    console.log("\nDry run — nothing was written. Re-run with --apply to make these changes.");
    return;
  }

  const result = await prisma.teacherPeriodAssignment.updateMany({
    where: { id: { in: losers } },
    data: { classId: null, subjectId: null }
  });
  console.log(`\nApplied: ${result.count} assignment(s) cleared to free periods.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
