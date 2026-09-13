import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { createHoliday } from "../src/modules/attendance/attendance.service.js";
import {
  createEvent,
  deleteEvent,
  listMonth,
  updateEvent
} from "../src/modules/calendar/calendar.service.js";

/**
 * Integration test for the Academic Calendar. Requires a reachable database
 * (DATABASE_URL). Creates two isolated schools, then deletes them (cascades)
 * at the end.
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

async function makeSchool(name: string) {
  const school = await prisma.school.create({
    data: { name, code: `CL-${randomUUID().slice(0, 8)}` }
  });

  const makeUser = async (fullName: string, role: "PRINCIPAL" | "TEACHER") => {
    const record = await prisma.user.create({
      data: { schoolId: school.id, fullName, phone: phone(), passwordHash: "x", role }
    });
    return { id: record.id, schoolId: school.id, role, fullName } as Express.UserContext;
  };

  return { school, makeUser };
}

async function main() {
  const home = await makeSchool("Calendar Test School");
  const other = await makeSchool("Other Calendar School");

  const principal = await home.makeUser("Calendar Test Principal", "PRINCIPAL");
  const teacher = await home.makeUser("Calendar Test Teacher", "TEACHER");
  const otherPrincipal = await other.makeUser("Other Principal", "PRINCIPAL");

  try {
    // ------------------------------------------------------------ creating
    const exam = await createEvent(principal, {
      type: "EXAM",
      title: "Unit Test 2",
      startDate: "2026-09-14",
      endDate: "2026-09-18"
    });
    assert.equal(exam.startDate, "2026-09-14");
    assert.equal(exam.endDate, "2026-09-18");
    assert.equal(exam.source, "EVENT");

    const meeting = await createEvent(principal, {
      type: "MEETING",
      title: "Parent Teacher Meeting",
      description: "Classes 6 to 8, in the main hall.",
      startDate: "2026-09-25"
    });
    assert.equal(meeting.endDate, "2026-09-25", "a missing end date means a one-day event");

    // Starts in August and runs into September, so it belongs to both months.
    const fair = await createEvent(principal, {
      type: "EVENT",
      title: "Science Exhibition",
      startDate: "2026-08-30",
      endDate: "2026-09-02"
    });

    // A holiday created through the existing attendance endpoint, exactly as
    // the web dashboard does it.
    await createHoliday(principal, new Date("2026-09-10"), "Founders Day");

    await createEvent(otherPrincipal, {
      type: "EVENT",
      title: "Another school's sports day",
      startDate: "2026-09-12"
    });

    // -------------------------------------------------------- who may edit
    await expectAppError(
      createEvent(teacher, { type: "EVENT", title: "Teacher event", startDate: "2026-09-01" }),
      "FORBIDDEN",
      403
    );
    await expectAppError(
      createEvent(principal, {
        type: "EVENT",
        title: "Backwards event",
        startDate: "2026-09-05",
        endDate: "2026-09-04"
      }),
      "INVALID_DATE_RANGE",
      400
    );

    // ------------------------------------------------------------- reading
    const september = await listMonth(teacher, "2026-09");
    assert.deepEqual(
      september.items.map((item) => item.title),
      ["Science Exhibition", "Founders Day", "Unit Test 2", "Parent Teacher Meeting"],
      "the teacher sees this school's events and holidays, sorted by start date"
    );

    const holiday = september.items.find((item) => item.source === "HOLIDAY");
    assert.equal(holiday?.type, "HOLIDAY");
    assert.equal(holiday?.startDate, "2026-09-10", "an existing holiday keeps its day");
    assert.equal(holiday?.endDate, "2026-09-10");

    const august = await listMonth(teacher, "2026-08");
    assert.deepEqual(
      august.items.map((item) => item.id),
      [fair.id],
      "an event spanning the month boundary appears in both months"
    );

    const october = await listMonth(teacher, "2026-10");
    assert.equal(october.items.length, 0);

    // ------------------------------------------------------------ updating
    await expectAppError(
      updateEvent(teacher, meeting.id, { type: "MEETING", title: "Moved", startDate: "2026-10-01" }),
      "FORBIDDEN",
      403
    );
    await expectAppError(
      updateEvent(otherPrincipal, meeting.id, {
        type: "MEETING",
        title: "Hijacked",
        startDate: "2026-10-01"
      }),
      "NOT_FOUND",
      404
    );

    const moved = await updateEvent(principal, meeting.id, {
      type: "MEETING",
      title: "Parent Teacher Meeting",
      startDate: "2026-10-01"
    });
    assert.equal(moved.startDate, "2026-10-01");
    assert.equal(moved.description, null, "a full update clears a description it omits");

    const afterMove = await listMonth(teacher, "2026-09");
    assert.ok(!afterMove.items.some((item) => item.id === meeting.id));
    assert.deepEqual(
      (await listMonth(teacher, "2026-10")).items.map((item) => item.id),
      [meeting.id]
    );

    // ------------------------------------------------------------ deleting
    await expectAppError(deleteEvent(otherPrincipal, exam.id), "NOT_FOUND", 404);
    await deleteEvent(principal, exam.id);
    await expectAppError(deleteEvent(principal, exam.id), "NOT_FOUND", 404);

    const afterDelete = await listMonth(teacher, "2026-09");
    assert.ok(!afterDelete.items.some((item) => item.id === exam.id));

    console.log("calendar: all assertions passed");
  } finally {
    await prisma.school.deleteMany({ where: { id: { in: [home.school.id, other.school.id] } } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
