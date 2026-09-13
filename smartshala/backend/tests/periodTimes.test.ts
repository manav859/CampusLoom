import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { getPeriodTimes, updatePeriodTimes } from "../src/modules/settings/settings.service.js";
import { getMySchedule } from "../src/modules/users/users.service.js";

/**
 * Integration test for the school bell (period start/end times) and the
 * teacher schedule that carries it. Requires a reachable database
 * (DATABASE_URL). Creates an isolated school and deletes it (cascades) at the end.
 */
async function expectAppError(promise: Promise<unknown>, code: string, statusCode: number) {
  try {
    await promise;
    assert.fail(`Expected an AppError with code ${code}, but the call succeeded`);
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
  }
}

function phone() {
  return `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;
}

async function main() {
  const school = await prisma.school.create({
    data: { name: "Bell Test School", code: `BT-${randomUUID().slice(0, 8)}`, timetablePeriodCount: 4 }
  });
  const principal = await prisma.user.create({
    data: { schoolId: school.id, fullName: "Bell Principal", phone: phone(), passwordHash: "x", role: "PRINCIPAL" }
  });
  const teacherRecord = await prisma.user.create({
    data: { schoolId: school.id, fullName: "Bell Teacher", phone: phone(), passwordHash: "x", role: "TEACHER" }
  });
  const teacher = {
    id: teacherRecord.id,
    schoolId: school.id,
    role: "TEACHER",
    fullName: teacherRecord.fullName
  } as Express.UserContext;

  const set = (periods: { periodNumber: number; startTime: string; endTime: string }[]) =>
    updatePeriodTimes(school.id, periods, principal.id);
  const mondayTimes = async () =>
    (await getMySchedule(teacher, "MONDAY")).periods.map((period) => [
      period.periodNumber,
      period.startTime,
      period.endTime
    ]);

  try {
    assert.deepEqual(await getPeriodTimes(school.id), { periodCount: 4, periods: [] });

    // ----------------------------------------------------------- validation
    await expectAppError(set([{ periodNumber: 5, startTime: "12:00", endTime: "12:40" }]), "PERIOD_OUT_OF_RANGE", 400);
    await expectAppError(set([{ periodNumber: 1, startTime: "08:40", endTime: "08:00" }]), "INVALID_PERIOD_TIME", 400);
    await expectAppError(set([{ periodNumber: 1, startTime: "08:00", endTime: "08:00" }]), "INVALID_PERIOD_TIME", 400);
    await expectAppError(
      set([
        { periodNumber: 1, startTime: "08:00", endTime: "08:40" },
        { periodNumber: 2, startTime: "08:30", endTime: "09:10" }
      ]),
      "OVERLAPPING_PERIODS",
      400
    );
    await expectAppError(
      set([
        { periodNumber: 1, startTime: "08:00", endTime: "08:40" },
        { periodNumber: 1, startTime: "09:00", endTime: "09:40" }
      ]),
      "DUPLICATE_PERIOD",
      400
    );
    assert.deepEqual((await getPeriodTimes(school.id)).periods, [], "a rejected bell stores nothing");

    // ------------------------------------------------------------- a bell
    // Sent out of order, with period 3 left untimed.
    const saved = await set([
      { periodNumber: 2, startTime: "08:45", endTime: "09:30" },
      { periodNumber: 1, startTime: "08:00", endTime: "08:45" },
      { periodNumber: 4, startTime: "10:30", endTime: "11:15" }
    ]);
    assert.deepEqual(
      saved.periods.map((period) => period.periodNumber),
      [1, 2, 4],
      "back-to-back periods are allowed and the result is in period order"
    );

    // --------------------------------------------- the teacher's schedule
    const classRecord = await prisma.class.create({
      data: { schoolId: school.id, name: "7", section: "B", academicYear: "2026-27", classTeacherId: teacher.id }
    });
    const subject = await prisma.subject.create({
      data: { schoolId: school.id, classId: classRecord.id, name: "Maths" }
    });
    for (const periodNumber of [1, 3]) {
      await prisma.teacherPeriodAssignment.create({
        data: {
          schoolId: school.id,
          teacherId: teacher.id,
          dayOfWeek: "MONDAY",
          periodNumber,
          classId: classRecord.id,
          subjectId: subject.id
        }
      });
    }

    assert.deepEqual(
      await mondayTimes(),
      [
        [1, "08:00", "08:45"],
        [3, null, null]
      ],
      "timed periods carry the bell; an untimed one carries nulls"
    );

    // Replacing the bell drops times that are no longer sent.
    await set([{ periodNumber: 1, startTime: "07:50", endTime: "08:30" }]);
    assert.deepEqual(await mondayTimes(), [
      [1, "07:50", "08:30"],
      [3, null, null]
    ]);

    // Lowering Periods Per Day hides times beyond it.
    await set([
      { periodNumber: 1, startTime: "07:50", endTime: "08:30" },
      { periodNumber: 4, startTime: "10:30", endTime: "11:15" }
    ]);
    await prisma.school.update({ where: { id: school.id }, data: { timetablePeriodCount: 3 } });
    const lowered = await getPeriodTimes(school.id);
    assert.equal(lowered.periodCount, 3);
    assert.deepEqual(lowered.periods.map((period) => period.periodNumber), [1]);

    console.log("periodTimes: all assertions passed");
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
