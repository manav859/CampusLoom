import assert from "node:assert/strict";
import { calculateStudentAttendanceSummary, type StudentAttendanceRecord } from "../src/core/studentAttendance.js";

const records: StudentAttendanceRecord[] = [
  { status: "ABSENT", session: { date: new Date("2026-04-01T00:00:00.000Z") } },
  { status: "ABSENT", session: { date: new Date("2026-04-02T00:00:00.000Z") } },
  { status: "PRESENT", session: { date: new Date("2026-05-01T00:00:00.000Z") } },
  { status: "PRESENT", session: { date: new Date("2026-05-02T00:00:00.000Z") } }
];

const profileSummary = calculateStudentAttendanceSummary(records);
const attendanceTabSummary = calculateStudentAttendanceSummary([...records].sort((a, b) => a.session.date.getTime() - b.session.date.getTime()));

assert.equal(profileSummary.attendancePercentage, 50);
assert.equal(attendanceTabSummary.attendancePercentage, profileSummary.attendancePercentage);
assert.equal(attendanceTabSummary.totalDays, 4);
assert.equal(attendanceTabSummary.absences, 2);
assert.equal(attendanceTabSummary.attended, 2);
assert.equal(attendanceTabSummary.lastAbsentDate?.toISOString(), "2026-04-02T00:00:00.000Z");

// Leave is an excused absence: it attends nothing and still counts as a
// school day, so it lowers the percentage exactly as an absence does. What it
// must never do is read as attendance — that is the silent way a new status
// inflates every number already on record.
const withLeave = calculateStudentAttendanceSummary([
  { status: "PRESENT", session: { date: new Date("2026-05-04T00:00:00.000Z") } },
  { status: "LEAVE", session: { date: new Date("2026-05-05T00:00:00.000Z") } }
]);

assert.equal(withLeave.totalDays, 2);
assert.equal(withLeave.attended, 1);
assert.equal(withLeave.leaves, 1);
assert.equal(withLeave.absences, 0, "leave is reported apart from absence");
assert.equal(withLeave.attendancePercentage, 50);
assert.equal(withLeave.lastAbsentDate, null, "a leave day is not an absence");

// A record written before this status existed carries its own stored value;
// the status branch must not override it.
const storedValue = calculateStudentAttendanceSummary([
  { status: "LEAVE", attendanceValue: 0, session: { date: new Date("2026-05-06T00:00:00.000Z") } }
]);
assert.equal(storedValue.attended, 0);

console.log("student attendance tests passed");
