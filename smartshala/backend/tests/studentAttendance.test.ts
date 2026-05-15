import assert from "node:assert/strict";
import { calculateStudentAttendanceSummary, type StudentAttendanceRecord } from "../src/core/studentAttendance.js";

const records: StudentAttendanceRecord[] = [
  { status: "ABSENT", session: { date: new Date("2026-04-01T00:00:00.000Z") } },
  { status: "ABSENT", session: { date: new Date("2026-04-02T00:00:00.000Z") } },
  { status: "PRESENT", session: { date: new Date("2026-05-01T00:00:00.000Z") } },
  { status: "LATE", session: { date: new Date("2026-05-02T00:00:00.000Z") } },
  { status: "HALF_DAY", attendanceValue: 0.5, session: { date: new Date("2026-05-03T00:00:00.000Z") } }
];

const profileSummary = calculateStudentAttendanceSummary(records);
const attendanceTabSummary = calculateStudentAttendanceSummary([...records].sort((a, b) => a.session.date.getTime() - b.session.date.getTime()));

assert.equal(profileSummary.attendancePercentage, 50);
assert.equal(attendanceTabSummary.attendancePercentage, profileSummary.attendancePercentage);
assert.equal(attendanceTabSummary.totalDays, 5);
assert.equal(attendanceTabSummary.absences, 2);
assert.equal(attendanceTabSummary.late, 1);
assert.equal(attendanceTabSummary.halfDays, 1);
assert.equal(attendanceTabSummary.attended, 2.5);
assert.equal(attendanceTabSummary.lastAbsentDate?.toISOString(), "2026-04-02T00:00:00.000Z");

console.log("student attendance tests passed");
