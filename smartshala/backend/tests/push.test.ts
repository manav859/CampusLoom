import assert from "node:assert/strict";
import { AnnouncementAudience } from "@prisma/client";
import {
  announcementPush,
  announcementRoles,
  attendanceReminderPush,
  calendarEventPush,
  childAbsentPush,
  formatDayRange,
  holidayPush,
  homeworkAssignedPush,
  leaveDecidedPush,
  leavePendingReminderPush,
  leaveSubmittedPush,
  marksPublishedPush,
  marksRecordedPush,
  studentLeaveDecidedPush,
  studentLeaveSubmittedPush
} from "../src/modules/push/push.messages.js";

/**
 * What a push notification says, and which screen the app opens when it is
 * tapped. No database and no Firebase: push.messages.ts is deliberately free of
 * both so the wording and the routing can be pinned down here.
 */

const day = (iso: string) => new Date(`${iso}T00:00:00`);

// ----------------------------------------------------------------- audiences

// A notice addressed to teachers wakes teachers, not the office. The principal
// who wrote it is excluded by the caller; another principal is simply not a
// recipient, because they can still read it in the Messages tab.
assert.deepEqual(announcementRoles(AnnouncementAudience.TEACHERS), ["TEACHER"]);

// Staff and school-wide notices reach everyone with an account.
assert.deepEqual(announcementRoles(AnnouncementAudience.STAFF), [
  "PRINCIPAL",
  "ADMIN",
  "TEACHER",
  "ACCOUNTANT"
]);
assert.deepEqual(
  announcementRoles(AnnouncementAudience.ALL),
  announcementRoles(AnnouncementAudience.STAFF)
);

// Parent notices go out over WhatsApp. Nobody's phone buzzes for one.
assert.deepEqual(announcementRoles(AnnouncementAudience.PARENTS), []);

// ----------------------------------------------------------------- dates

// A one-day leave reads as one date, not a range of a date with itself.
assert.equal(formatDayRange(day("2026-10-21"), day("2026-10-21"), day("2026-10-01")), "21 Oct");
assert.equal(
  formatDayRange(day("2026-10-21"), day("2026-10-23"), day("2026-10-01")),
  "21 Oct – 23 Oct"
);

// Next year's date carries its year; this year's does not.
assert.equal(formatDayRange(day("2027-01-04"), day("2027-01-04"), day("2026-10-01")), "4 Jan 2027");

// ----------------------------------------------------------------- wording

const announcement = announcementPush({
  title: "Parent-teacher meeting",
  body: "Saturday, 9am in the hall.",
  isUrgent: false
});
assert.equal(announcement.title, "Parent-teacher meeting");
assert.equal(announcement.data.target, "messages");
assert.equal(announcement.data.kind, "announcement");

// An urgent notice says so in the one line the lock screen shows.
assert.equal(
  announcementPush({ title: "School closed", body: "Heavy rain.", isUrgent: true }).title,
  "Urgent: School closed"
);

// A long notice body is cut to fit a notification rather than sent whole, and
// newlines are folded so the shade shows one readable line.
const long = announcementPush({
  title: "Notice",
  body: `Line one.\nLine two.${" word".repeat(60)}`,
  isUrgent: false
});
assert.equal(long.body.length, 140);
assert.ok(long.body.endsWith("…"));
assert.ok(!long.body.includes("\n"));

const submitted = leaveSubmittedPush({
  applicantName: "Anita Kumari",
  type: "CASUAL",
  fromDate: day("2026-10-21"),
  toDate: day("2026-10-23"),
  days: 3
});
assert.equal(submitted.title, "Leave request from Anita Kumari");
assert.ok(submitted.body.startsWith("casual leave, 21 Oct – 23 Oct"));
assert.ok(submitted.body.endsWith("(3 days)"));
// The approval queue, not the feed: this is a notification that needs an answer.
assert.equal(submitted.data.target, "leave_approval");

// One day is "1 day", and a two-word leave type reads as words.
const oneDay = leaveSubmittedPush({
  applicantName: "Ravi",
  type: "MATERNITY",
  fromDate: day("2026-10-21"),
  toDate: day("2026-10-21"),
  days: 1
});
assert.ok(oneDay.body.endsWith("(1 day)"));
assert.ok(oneDay.body.startsWith("maternity leave, 21 Oct "));

const approved = leaveDecidedPush({
  approved: true,
  fromDate: day("2026-10-21"),
  toDate: day("2026-10-21")
});
assert.equal(approved.title, "Leave approved");
assert.equal(approved.body, "Your leave for 21 Oct.");
assert.equal(approved.data.target, "messages");

// A rejection carries the principal's reason, which is the part that matters.
const rejected = leaveDecidedPush({
  approved: false,
  fromDate: day("2026-10-21"),
  toDate: day("2026-10-22"),
  note: "Exams that week"
});
assert.equal(rejected.title, "Leave not approved");
assert.equal(rejected.body, "21 Oct – 22 Oct — Exams that week");

const marks = marksRecordedPush({
  examName: "Unit Test 2",
  className: "9-C",
  subject: "Hindi",
  enteredByName: "Anita Kumari",
  studentCount: 32
});
assert.equal(marks.title, "Unit Test 2 marks recorded");
assert.equal(marks.body, "9-C Hindi — 32 students, entered by Anita Kumari.");
assert.equal(marks.data.target, "home");

const exam = calendarEventPush({
  type: "EXAM",
  title: "Half Yearly",
  startDate: day("2026-11-02"),
  endDate: day("2026-11-09")
});
assert.equal(exam.title, "Exam: Half Yearly");
assert.equal(exam.body, "2 Nov – 9 Nov");
assert.equal(exam.data.target, "calendar");

assert.equal(
  calendarEventPush({
    type: "MEETING",
    title: "Staff briefing",
    startDate: day("2026-11-02"),
    endDate: day("2026-11-02")
  }).title,
  "Meeting: Staff briefing"
);

assert.equal(holidayPush({ reason: "Diwali", date: day("2026-11-08") }).title, "Holiday: Diwali");

// ----------------------------------------------------------------- reminders

assert.equal(
  attendanceReminderPush({ classNames: ["1-A"] }).body,
  "1-A has no attendance for today yet."
);
assert.equal(
  attendanceReminderPush({ classNames: ["1-A", "2-B"] }).body,
  "1-A, 2-B have no attendance for today yet."
);

assert.equal(
  leavePendingReminderPush({ count: 1, oldest: day("2026-10-18") }).title,
  "1 leave request waiting"
);
assert.equal(
  leavePendingReminderPush({ count: 4, oldest: day("2026-10-18") }).title,
  "4 leave requests waiting"
);
assert.equal(
  leavePendingReminderPush({ count: 4, oldest: day("2026-10-18") }).data.target,
  "leave_approval"
);

// ----------------------------------------------------------------- parent app

// An absence names only the child's first name and the day; the detail is in
// the app, and the tap opens the child's dashboard (Home).
const absent = childAbsentPush({ studentName: "Aarav Sharma", date: day("2026-10-21") });
assert.equal(absent.title, "Marked absent today");
assert.equal(absent.body, "Aarav was marked absent on 21 Oct.");
assert.equal(absent.data.kind, "child_absent");
assert.equal(absent.data.target, "home");

const homework = homeworkAssignedPush({
  subject: "Science",
  title: "Chapter 4 questions",
  dueDate: day("2026-10-24")
});
assert.equal(homework.title, "New Science homework");
assert.equal(homework.body, "Chapter 4 questions — due 24 Oct.");
assert.equal(homework.data.target, "home");

// A result push never carries the marks — the parent opens them in the app.
const result = marksPublishedPush({ examName: "Unit Test 2", subject: "Hindi" });
assert.equal(result.title, "Unit Test 2 result out");
assert.equal(result.body, "Hindi marks have been published.");
assert.equal(result.data.kind, "marks_published");
assert.equal(result.data.target, "home");

// A parent-raised child leave reaching the office — staff review it on the web.
const leaveIn = studentLeaveSubmittedPush({
  studentName: "Aarav Sharma",
  fromDate: day("2026-10-21"),
  toDate: day("2026-10-22"),
  days: 2
});
assert.equal(leaveIn.title, "Leave request for Aarav");
assert.equal(leaveIn.body, "21 Oct – 22 Oct (2 days) — awaiting review.");
assert.equal(leaveIn.data.kind, "student_leave_submitted");

// The parent, told the outcome; a note is appended when the office left one.
const leaveYes = studentLeaveDecidedPush({
  studentName: "Aarav Sharma",
  approved: true,
  fromDate: day("2026-10-21"),
  toDate: day("2026-10-21")
});
assert.equal(leaveYes.title, "Leave approved");
assert.equal(leaveYes.body, "Aarav's leave for 21 Oct.");
assert.equal(leaveYes.data.target, "home");

const leaveNo = studentLeaveDecidedPush({
  studentName: "Aarav Sharma",
  approved: false,
  fromDate: day("2026-10-21"),
  toDate: day("2026-10-22"),
  note: "Exams that week"
});
assert.equal(leaveNo.title, "Leave not approved");
assert.equal(leaveNo.body, "Aarav's leave for 21 Oct – 22 Oct — Exams that week");

console.log("push notification message tests passed");
