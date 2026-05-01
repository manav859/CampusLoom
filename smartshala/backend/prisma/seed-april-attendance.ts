/**
 * Mock April 2026 attendance for ALL students across ALL classes.
 *
 * - Covers April 1-30, 2026
 * - Excludes Sundays and Indian national holidays
 * - ~85% PRESENT, ~10% ABSENT, ~5% LATE (randomised per student per day)
 * - Upserts sessions so it is safe to re-run
 *
 * Usage:  npx tsx prisma/seed-april-attendance.ts
 * Env:    Set DATABASE_URL before running (local .env is auto-loaded)
 */

import { PrismaClient, AttendanceStatus } from "@prisma/client";

const prisma = new PrismaClient();

/* ── April 2026 holidays (India) — excludes Sundays automatically ── */
const APRIL_2026_HOLIDAYS = new Set([
  // 2026-04-02: Mahavir Jayanti (Thu)
  2,
  // 2026-04-03: Good Friday (Fri)
  3,
  // 2026-04-14: Dr. Ambedkar Jayanti (Tue)
  14,
]);

function isWorkingDay(day: number): boolean {
  const date = new Date(2026, 3, day); // April = month index 3
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return false; // Sunday
  if (APRIL_2026_HOLIDAYS.has(day)) return false;
  return true;
}

function randomStatus(): AttendanceStatus {
  const r = Math.random();
  if (r < 0.10) return AttendanceStatus.ABSENT;   // 10%
  if (r < 0.15) return AttendanceStatus.LATE;      // 5%
  return AttendanceStatus.PRESENT;                  // 85%
}

async function main() {
  console.log("=== Mock April 2026 Attendance Seeder ===\n");

  // Get all schools (usually just one)
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });

  for (const school of schools) {
    console.log(`📌 School: ${school.name}`);

    // Get all classes for this school
    const classes = await prisma.class.findMany({
      where: { schoolId: school.id },
      select: { id: true, name: true, section: true, classTeacherId: true },
    });

    // Get a fallback markedBy user (any teacher/admin in school)
    const fallbackUser = await prisma.user.findFirst({
      where: { schoolId: school.id },
      select: { id: true },
    });

    if (!fallbackUser) {
      console.log("  ⚠ No users found for this school – skipping.");
      continue;
    }

    // Build list of working days in April 2026
    const workingDays: Date[] = [];
    for (let day = 1; day <= 30; day++) {
      if (isWorkingDay(day)) {
        const d = new Date(2026, 3, day);
        d.setHours(0, 0, 0, 0);
        workingDays.push(d);
      }
    }
    console.log(`  📅 Working days in April 2026: ${workingDays.length}`);

    let totalSessions = 0;
    let totalRecords = 0;

    for (const cls of classes) {
      const markedById = cls.classTeacherId ?? fallbackUser.id;

      // Get all active students in this class
      const students = await prisma.student.findMany({
        where: { classId: cls.id, isActive: true },
        select: { id: true },
      });

      if (students.length === 0) continue;

      for (const date of workingDays) {
        // Upsert session (safe to re-run)
        let session;
        try {
          session = await prisma.attendanceSession.upsert({
            where: {
              schoolId_classId_date: {
                schoolId: school.id,
                classId: cls.id,
                date,
              },
            },
            update: {}, // keep existing if already present
            create: {
              schoolId: school.id,
              classId: cls.id,
              date,
              markedById,
            },
          });
        } catch {
          // If the unique constraint explodes for some reason, just skip
          continue;
        }

        totalSessions++;

        // Delete any existing records for this session to avoid duplicates
        await prisma.attendanceRecord.deleteMany({
          where: { sessionId: session.id },
        });

        // Create attendance records for every student
        const records = students.map((st) => ({
          schoolId: school.id,
          sessionId: session.id,
          studentId: st.id,
          status: randomStatus(),
        }));

        await prisma.attendanceRecord.createMany({
          data: records,
          skipDuplicates: true,
        });

        totalRecords += records.length;
      }

      process.stdout.write(`  ✅ ${cls.name}-${cls.section} (${students.length} students) done\n`);
    }

    console.log(`\n  📊 Summary for ${school.name}:`);
    console.log(`     Sessions created/updated: ${totalSessions}`);
    console.log(`     Attendance records: ${totalRecords}\n`);
  }

  console.log("=== Done! ===");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
