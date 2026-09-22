import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { getClassTimetable } from "../src/modules/classes/classes.service.js";
import { getMyWeekSchedule } from "../src/modules/users/users.service.js";
import { updatePeriodTimes } from "../src/modules/settings/settings.service.js";

/**
 * Integration test for the two reads the apps' Timetable screens make:
 * GET /classes/:id/timetable (the principal app) and GET /users/me/schedule/week
 * (the teacher app). Requires a reachable database (DATABASE_URL). Creates an
 * isolated school and deletes it (cascades) at the end.
 */
async function expectAppError(promise: Promise<unknown>, statusCode: number) {
  try {
    await promise;
    assert.fail("Expected an AppError, but the call succeeded");
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.statusCode, statusCode);
  }
}

function phone() {
  return `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;
}

const context = (user: { id: string; schoolId: string; role: string; fullName: string }) => user as Express.UserContext;

async function main() {
  const school = await prisma.school.create({
    data: { name: "Timetable Test School", code: `TT-${randomUUID().slice(0, 8)}`, timetablePeriodCount: 3 }
  });
  const other = await prisma.school.create({
    data: { name: "Timetable Other School", code: `TO-${randomUUID().slice(0, 8)}`, timetablePeriodCount: 3 }
  });

  const make = (schoolId: string, fullName: string, role: "PRINCIPAL" | "TEACHER") =>
    prisma.user.create({ data: { schoolId, fullName, phone: phone(), passwordHash: "x", role } });

  const principalRecord = await make(school.id, "Timetable Principal", "PRINCIPAL");
  // "Anita" sorts before "Bhaskar": the contested-slot check below relies on it.
  const anitaRecord = await make(school.id, "Anita Rao", "TEACHER");
  const bhaskarRecord = await make(school.id, "Bhaskar Nair", "TEACHER");
  const outsiderRecord = await make(school.id, "Outsider Teacher", "TEACHER");

  const principal = context({ ...principalRecord, schoolId: school.id, role: "PRINCIPAL" });
  const anita = context({ ...anitaRecord, schoolId: school.id, role: "TEACHER" });
  const bhaskar = context({ ...bhaskarRecord, schoolId: school.id, role: "TEACHER" });
  const outsider = context({ ...outsiderRecord, schoolId: school.id, role: "TEACHER" });

  const classRecord = await prisma.class.create({
    data: { schoolId: school.id, name: "6", section: "A", academicYear: "2026-2027" }
  });
  const otherClass = await prisma.class.create({
    data: { schoolId: other.id, name: "6", section: "A", academicYear: "2026-2027" }
  });
  const maths = await prisma.subject.create({
    data: { schoolId: school.id, classId: classRecord.id, name: "Mathematics", teacherId: anitaRecord.id }
  });
  const science = await prisma.subject.create({
    data: { schoolId: school.id, classId: classRecord.id, name: "Science", teacherId: bhaskarRecord.id }
  });

  const assign = (
    teacherId: string,
    dayOfWeek: string,
    periodNumber: number,
    subjectId: string | null,
    classId: string | null = classRecord.id
  ) =>
    prisma.teacherPeriodAssignment.create({
      data: { schoolId: school.id, teacherId, dayOfWeek, periodNumber, classId, subjectId }
    });

  try {
    // Anita: Monday P1 Maths, Tuesday P2 Maths, and a genuinely free Monday P3.
    await assign(anitaRecord.id, "MONDAY", 1, maths.id);
    await assign(anitaRecord.id, "TUESDAY", 2, maths.id);
    await assign(anitaRecord.id, "MONDAY", 3, null, null);
    // Bhaskar: Monday P2 Science.
    await assign(bhaskarRecord.id, "MONDAY", 2, science.id);

    await updatePeriodTimes(
      school.id,
      [
        { periodNumber: 1, startTime: "08:00", endTime: "08:40" },
        { periodNumber: 2, startTime: "08:45", endTime: "09:25" }
      ],
      principalRecord.id
    );

    // ------------------------------------------------- the class week
    const week = await getClassTimetable(principal, classRecord.id);
    assert.equal(week.periodCount, 3);
    assert.deepEqual(
      week.days.map((day) => day.dayOfWeek),
      ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    );
    assert.equal(week.days[0].label, "Monday");
    assert.ok(
      week.days.every((day) => day.periods.length === 3),
      "every weekday carries every period, free or not"
    );

    const monday = week.days[0].periods;
    assert.deepEqual(
      [monday[0].subjectName, monday[0].teacherName, monday[0].startTime, monday[0].endTime, monday[0].contestedBy],
      ["Mathematics", "Anita Rao", "08:00", "08:40", 0]
    );
    assert.deepEqual(
      [monday[1].subjectName, monday[1].teacherName, monday[1].startTime, monday[1].endTime],
      ["Science", "Bhaskar Nair", "08:45", "09:25"]
    );
    // Period 3 has no bell and nobody teaches the class then.
    assert.deepEqual(
      [
        monday[2].subjectId,
        monday[2].subjectName,
        monday[2].teacherId,
        monday[2].teacherName,
        monday[2].startTime,
        monday[2].endTime
      ],
      [null, null, null, null, null, null]
    );

    const tuesday = week.days[1].periods;
    assert.equal(tuesday[1].subjectName, "Mathematics");
    assert.equal(tuesday[0].teacherName, null, "Tuesday period 1 is free for this class");
    assert.ok(
      week.days.slice(2).every((day) => day.periods.every((period) => period.teacherId === null)),
      "Wednesday to Friday are free"
    );

    // ------------------------------------------- two teachers, one slot
    // ensureTeacherPeriods seeds assignments with no conflict check, so this is
    // reachable without going through the web grid.
    await assign(bhaskarRecord.id, "MONDAY", 1, science.id);
    const contested = (await getClassTimetable(principal, classRecord.id)).days[0].periods[0];
    assert.equal(contested.contestedBy, 1);
    assert.equal(contested.teacherName, "Anita Rao", "the first teacher by name holds the slot");
    await prisma.teacherPeriodAssignment.deleteMany({
      where: { schoolId: school.id, teacherId: bhaskarRecord.id, dayOfWeek: "MONDAY", periodNumber: 1 }
    });

    // --------------------------------------------------------- access
    await expectAppError(getClassTimetable(principal, otherClass.id), 404);
    assert.equal(
      (await getClassTimetable(anita, classRecord.id)).class.id,
      classRecord.id,
      "a teacher with periods in the class may read its timetable"
    );
    await expectAppError(getClassTimetable(outsider, classRecord.id), 404);

    // ------------------------------------------- the teacher own week
    const anitaWeek = await getMyWeekSchedule(anita);
    assert.deepEqual(
      anitaWeek.days.map((day) => day.dayOfWeek),
      ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    );
    assert.deepEqual(
      anitaWeek.days[0].periods.map((period) => [
        period.periodNumber,
        period.subjectName,
        period.className,
        period.startTime
      ]),
      [[1, "Mathematics", "6-A", "08:00"]],
      "Monday period 3 has no class, so it is not in the teacher week"
    );
    assert.deepEqual(
      anitaWeek.days[1].periods.map((period) => [period.periodNumber, period.subjectName, period.endTime]),
      [[2, "Mathematics", "09:25"]]
    );
    assert.ok(
      anitaWeek.days.slice(2).every((day) => day.periods.length === 0),
      "Wednesday to Friday are empty"
    );

    const bhaskarWeek = await getMyWeekSchedule(bhaskar);
    assert.deepEqual(
      bhaskarWeek.days[0].periods.map((period) => [period.periodNumber, period.subjectName]),
      [[2, "Science"]],
      "a teacher week carries only their own periods"
    );
    assert.equal(
      (await getMyWeekSchedule(outsider)).days.every((day) => day.periods.length === 0),
      true
    );

    console.log("timetable.test.ts passed");
  } finally {
    await prisma.school.deleteMany({ where: { id: { in: [school.id, other.id] } } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
