import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/core/prisma.js";
import { AppError } from "../src/core/errors.js";
import { childTimetable, parentExamSchedule } from "../src/modules/parent/parent.service.js";
import { updatePeriodTimes } from "../src/modules/settings/settings.service.js";

/**
 * Integration test for the two parent reads added for the Parent app's
 * Timetable and Exam Schedule screens:
 *   GET /parent/children/:id/timetable
 *   GET /parent/exams
 * Requires a reachable database (DATABASE_URL). Creates an isolated school and
 * deletes it (cascades) at the end — so it refuses to run against anything but
 * a local database.
 */
const url = process.env.DATABASE_URL ?? "";
assert.ok(
  /@(localhost|127\.0\.0\.1)[:/]/.test(url),
  "Point DATABASE_URL at a local database before running this test"
);

function phone() {
  return `9${randomUUID().replace(/\D/g, "").slice(0, 9)}`;
}

const context = (user: { id: string; schoolId: string; role: string; fullName: string; phone?: string }) =>
  user as Express.UserContext;

/** Midnight UTC, the way the calendar stores an event day. */
function day(offsetDays: number) {
  const now = new Date();
  const utc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(utc + offsetDays * 86400000);
}

async function main() {
  const school = await prisma.school.create({
    data: { name: "Parent Screens School", code: `PS-${randomUUID().slice(0, 8)}`, timetablePeriodCount: 3 }
  });

  const parentMobile = phone();
  const otherMobile = phone();

  try {
    const anita = await prisma.user.create({
      data: { schoolId: school.id, fullName: "Anita Rao", phone: phone(), passwordHash: "x", role: "TEACHER" }
    });
    const principal = await prisma.user.create({
      data: { schoolId: school.id, fullName: "P One", phone: phone(), passwordHash: "x", role: "PRINCIPAL" }
    });
    const classRecord = await prisma.class.create({
      data: { schoolId: school.id, name: "6", section: "A", academicYear: "2026-2027" }
    });
    const maths = await prisma.subject.create({
      data: { schoolId: school.id, classId: classRecord.id, name: "Mathematics", teacherId: anita.id }
    });

    const student = (fullName: string, guardianPhone: string, classId: string) =>
      prisma.student.create({
        data: {
          schoolId: school.id,
          classId,
          fullName,
          admissionNumber: `ADM-${randomUUID().slice(0, 6)}`,
          parentName: "Guardian",
          parentPhone: guardianPhone,
          dateOfBirth: new Date("2016-04-01"),
          gender: "MALE"
        }
      });

    const mine = await student("Aarav Guardianson", parentMobile, classRecord.id);
    const notMine = await student("Someone Else", otherMobile, classRecord.id);

    const parent = context({
      id: `parent:${parentMobile}`,
      schoolId: school.id,
      role: "PARENT",
      fullName: "Guardian",
      phone: parentMobile
    });

    // Monday P1 Maths with Anita; Monday P3 left genuinely free.
    await prisma.teacherPeriodAssignment.create({
      data: { schoolId: school.id, teacherId: anita.id, dayOfWeek: "MONDAY", periodNumber: 1, classId: classRecord.id, subjectId: maths.id }
    });
    await updatePeriodTimes(
      school.id,
      [{ periodNumber: 1, startTime: "08:00", endTime: "08:40" }],
      principal.id
    );

    // ------------------------------------------------------- the child's week
    const week = await childTimetable(parent, mine.id);
    assert.deepEqual(week.class, {
      id: classRecord.id,
      name: "6",
      section: "A",
      academicYear: "2026-2027"
    });
    assert.equal(week.periodCount, 3);
    assert.deepEqual(
      week.days.map((entry) => entry.dayOfWeek),
      ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    );
    assert.ok(week.days.every((entry) => entry.periods.length === 3), "every weekday carries every period");

    const monday = week.days[0].periods;
    assert.deepEqual(
      [monday[0].periodNumber, monday[0].subjectName, monday[0].teacherName, monday[0].startTime, monday[0].endTime],
      [1, "Mathematics", "Anita Rao", "08:00", "08:40"]
    );
    // A free period is sent as nulls, so the app can lay out a full grid.
    assert.deepEqual([monday[2].subjectName, monday[2].teacherName, monday[2].startTime], [null, null, null]);
    // The staff-only double-booking flag must not reach a parent.
    assert.deepEqual(Object.keys(monday[0]), [
      "periodNumber",
      "startTime",
      "endTime",
      "subjectName",
      "teacherName"
    ]);

    // ------------------------------------------------------------- ownership
    await assert.rejects(
      childTimetable(parent, notMine.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
      "another family's child is a 404, not someone else's timetable"
    );

    // ---------------------------------------------------------- the datesheet
    const event = (type: "EXAM" | "EVENT", title: string, start: number, end: number) =>
      prisma.calendarEvent.create({
        data: { schoolId: school.id, type, title, startDate: day(start), endDate: day(end) }
      });

    await event("EXAM", "Half-Yearly Exam", 20, 28);
    await event("EXAM", "Running Today", -1, 0);
    await event("EXAM", "Unit Test 1", -60, -60);
    await event("EVENT", "Sports Day", 10, 10);

    const schedule = await parentExamSchedule(parent);
    assert.deepEqual(
      schedule.upcoming.map((entry) => entry.title),
      ["Running Today", "Half-Yearly Exam"],
      "soonest first, and an exam ending today still counts as upcoming"
    );
    assert.deepEqual(schedule.past.map((entry) => entry.title), ["Unit Test 1"]);
    assert.ok(
      schedule.upcoming.every((entry) => entry.type === "EXAM"),
      "only exams — Sports Day belongs to the Calendar tab"
    );
    // Plain YYYY-MM-DD days, as the app's CalendarEvent parses.
    assert.match(schedule.upcoming[1].startDate, /^\d{4}-\d{2}-\d{2}$/);

    console.log("parent timetable + exam schedule: all assertions passed");
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
