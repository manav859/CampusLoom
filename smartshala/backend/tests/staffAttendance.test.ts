import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { getTodayStatus, punchIn, punchOut } from "../src/modules/staffAttendance/staffAttendance.service.js";

/**
 * Integration test for the teacher "Swipe To Punch" endpoints. Requires a
 * reachable database (DATABASE_URL). Creates an isolated school + teacher,
 * exercises the punch state machine, then deletes the school (cascades).
 */
async function expectAppError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    assert.fail(`Expected an AppError with code ${code}, but the call succeeded`);
  } catch (error) {
    assert.ok(error instanceof AppError, `Expected AppError, got ${String(error)}`);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, 409);
  }
}

async function main() {
  const school = await prisma.school.create({
    data: { name: "Punch Test School", code: `PT-${randomUUID().slice(0, 8)}` }
  });

  const teacher = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: "Punch Test Teacher",
      phone: `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`,
      passwordHash: "x",
      role: "TEACHER"
    }
  });

  const user = {
    id: teacher.id,
    schoolId: school.id,
    role: "TEACHER",
    fullName: teacher.fullName
  } as Express.UserContext;

  try {
    // A fresh day starts with nothing recorded.
    const initial = await getTodayStatus(user);
    assert.equal(initial.state, "NOT_PUNCHED_IN");
    assert.equal(initial.punchInAt, null);
    assert.equal(initial.workedMinutes, 0);

    // Punching out before punching in is rejected.
    await expectAppError(punchOut(user), "NOT_PUNCHED_IN");

    // First punch-in succeeds.
    const punchedIn = await punchIn(user);
    assert.equal(punchedIn.state, "PUNCHED_IN");
    assert.ok(punchedIn.punchInAt instanceof Date);
    assert.equal(punchedIn.punchOutAt, null);

    // The status endpoint agrees.
    const afterIn = await getTodayStatus(user);
    assert.equal(afterIn.state, "PUNCHED_IN");

    // A second punch-in on the same day is rejected.
    await expectAppError(punchIn(user), "ALREADY_PUNCHED_IN");

    // Punch-out completes the day.
    const punchedOut = await punchOut(user);
    assert.equal(punchedOut.state, "PUNCHED_OUT");
    assert.ok(punchedOut.punchOutAt instanceof Date);

    // Neither punch may be repeated afterwards.
    await expectAppError(punchOut(user), "ALREADY_PUNCHED_OUT");
    await expectAppError(punchIn(user), "ALREADY_PUNCHED_OUT");

    // Exactly one row exists for the day.
    const rows = await prisma.staffAttendance.count({ where: { userId: teacher.id } });
    assert.equal(rows, 1);

    const final = await getTodayStatus(user);
    assert.equal(final.state, "PUNCHED_OUT");

    console.log("staffAttendance: all assertions passed");
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
