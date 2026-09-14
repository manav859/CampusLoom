import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { getStaffMonthSummary } from "../src/modules/staffAttendance/staffAttendance.service.js";

/**
 * Integration test for the principal's month summary of one staff member.
 * Requires a reachable database (DATABASE_URL). September 2026 starts on a
 * Tuesday; "today" is Monday the 14th.
 */
const now = new Date(2026, 8, 14, 11, 0);
const local = (day: number) => new Date(2026, 8, day);
const utc = (day: number) => new Date(Date.UTC(2026, 8, day));

async function expectNotFound(promise: Promise<unknown>) {
  await assert.rejects(promise, (error) => error instanceof AppError && error.statusCode === 404);
}

async function main() {
  const school = await prisma.school.create({ data: { name: "Summary Test School", code: `SM-${randomUUID().slice(0, 8)}` } });
  const otherSchool = await prisma.school.create({ data: { name: "Other School", code: `SO-${randomUUID().slice(0, 8)}` } });

  const makeUser = (schoolId: string, role: "TEACHER" | "ACCOUNTANT", createdAt: Date) =>
    prisma.user.create({
      data: {
        schoolId,
        fullName: `${role} ${randomUUID().slice(0, 4)}`,
        phone: `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`,
        passwordHash: "x",
        role,
        createdAt
      }
    });

  try {
    const teacher = await makeUser(school.id, "TEACHER", new Date(2026, 7, 1));
    const newJoiner = await makeUser(school.id, "TEACHER", new Date(2026, 8, 10, 15, 30));
    const accountant = await makeUser(school.id, "ACCOUNTANT", new Date(2026, 7, 1));
    const outsider = await makeUser(otherSchool.id, "TEACHER", new Date(2026, 7, 1));

    await prisma.holiday.create({ data: { schoolId: school.id, date: local(2), reason: "Founders Day" } });
    await prisma.holiday.create({ data: { schoolId: otherSchool.id, date: local(3), reason: "Not ours" } });
    await prisma.staffAttendance.createMany({
      data: [1, 3, 4].map((day) => ({ schoolId: school.id, userId: teacher.id, date: local(day), punchInAt: local(day) }))
    });
    await prisma.leaveRequest.createMany({
      data: [
        { schoolId: school.id, userId: teacher.id, type: "CASUAL", status: "APPROVED", fromDate: utc(7), toDate: utc(8), reason: "Family" },
        { schoolId: school.id, userId: teacher.id, type: "CASUAL", status: "REJECTED", fromDate: utc(9), toDate: utc(9), reason: "No" },
        { schoolId: school.id, userId: teacher.id, type: "SICK", status: "APPROVED", fromDate: new Date(Date.UTC(2026, 7, 30)), toDate: utc(1), reason: "Fever" }
      ]
    });

    // Working days 1, 3-5, 7-12: the 2nd is a holiday, 6th and 13th are Sundays,
    // and today (14th) is not over. The 1st is punched, so the leave over it does not count.
    const summary = await getStaffMonthSummary(school.id, teacher.id, "2026-09", now);
    assert.deepEqual(summary, { month: "2026-09", workingDays: 10, presentDays: 3, leaveDays: 2, absentDays: 5, percentage: 30 });

    // Once today is punched it counts.
    await prisma.staffAttendance.create({ data: { schoolId: school.id, userId: teacher.id, date: local(14), punchInAt: now } });
    const afterPunch = await getStaffMonthSummary(school.id, teacher.id, "2026-09", now);
    assert.equal(afterPunch.presentDays, 4);
    assert.equal(afterPunch.workingDays, 11);
    assert.equal(afterPunch.percentage, 36);

    // Days before joining are not absences.
    const joiner = await getStaffMonthSummary(school.id, newJoiner.id, "2026-09", now);
    assert.deepEqual(joiner, { month: "2026-09", workingDays: 3, presentDays: 0, leaveDays: 0, absentDays: 3, percentage: 0 });

    // A future month has no working days yet.
    const future = await getStaffMonthSummary(school.id, teacher.id, "2026-10", now);
    assert.equal(future.workingDays, 0);
    assert.equal(future.percentage, null);

    // A past month counts every working day; August 2026 has 26 non-Sundays and the SICK leave covers the 30th-31st (30th is a Sunday).
    const august = await getStaffMonthSummary(school.id, teacher.id, "2026-08", now);
    assert.deepEqual(august, { month: "2026-08", workingDays: 26, presentDays: 0, leaveDays: 1, absentDays: 25, percentage: 0 });

    // Only this school's staff.
    await expectNotFound(getStaffMonthSummary(school.id, outsider.id, "2026-09", now));
    await expectNotFound(getStaffMonthSummary(school.id, accountant.id, "2026-09", now));

    console.log("staffMonthSummary: all assertions passed");
  } finally {
    await prisma.school.deleteMany({ where: { id: { in: [school.id, otherSchool.id] } } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
