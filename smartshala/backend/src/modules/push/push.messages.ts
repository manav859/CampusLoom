import { AnnouncementAudience, UserRole } from "@prisma/client";
import type { PushPayload } from "./fcm.js";

/**
 * What a notification says and which screen it opens — kept apart from the
 * database and the network so the wording and the routing can be tested
 * without either. `target` is the only contract the apps depend on.
 */

/** Screens both apps can be sent to. An app ignores a target it has no tab for. */
export type PushTarget = "home" | "messages" | "calendar" | "leave_approval";

export type PushKind =
  | "announcement"
  | "leave_submitted"
  | "leave_decided"
  | "marks_recorded"
  | "calendar_event"
  | "holiday"
  | "attendance_reminder"
  | "leave_pending_reminder"
  // Parent app
  | "child_absent"
  | "homework_assigned"
  | "marks_published"
  | "student_leave_submitted"
  | "student_leave_decided";

/** A notification body is one line in a shade; anything longer is cut anyway. */
const MAX_BODY = 140;

function trim(value: string) {
  const single = value.replace(/\s+/g, " ").trim();
  return single.length <= MAX_BODY ? single : `${single.slice(0, MAX_BODY - 1)}…`;
}

/** "7 Oct" / "7 Oct 2027" — the year only when it is not the current one. */
export function formatDay(date: Date, now = new Date()) {
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" })
  });
}

export function formatDayRange(from: Date, to: Date, now = new Date()) {
  const start = formatDay(from, now);
  return from.getTime() === to.getTime() ? start : `${start} – ${formatDay(to, now)}`;
}

function payload(kind: PushKind, target: PushTarget, title: string, body: string): PushPayload {
  return { title, body: trim(body), data: { kind, target } };
}

/**
 * Which roles a notice is pushed to. This follows the audience the author
 * picked rather than who can *see* the notice in the list: a principal can open
 * a notice addressed to teachers, but being woken by one they did not write is
 * noise. PARENTS notices reach parents over WhatsApp and are not pushed to any
 * staff phone, which is why the list can be empty.
 */
export function announcementRoles(audience: AnnouncementAudience): UserRole[] {
  switch (audience) {
    case AnnouncementAudience.TEACHERS:
      return [UserRole.TEACHER];
    case AnnouncementAudience.ALL:
    case AnnouncementAudience.STAFF:
      return [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT];
    case AnnouncementAudience.PARENTS:
      return [];
  }
}

/** Roles that decide leave, and so are the ones told a request has come in. */
export const approverRoles: UserRole[] = [UserRole.PRINCIPAL, UserRole.ADMIN];

/** Every role with an app of its own. */
export const staffRoles: UserRole[] = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER];

export function announcementPush(input: {
  title: string;
  body: string;
  isUrgent: boolean;
}): PushPayload {
  return payload(
    "announcement",
    "messages",
    input.isUrgent ? `Urgent: ${input.title}` : input.title,
    input.body
  );
}

export function leaveSubmittedPush(input: {
  applicantName: string;
  type: string;
  fromDate: Date;
  toDate: Date;
  days: number;
}): PushPayload {
  const kind = input.type.toLowerCase().replace(/_/g, " ");
  return payload(
    "leave_submitted",
    "leave_approval",
    `Leave request from ${input.applicantName}`,
    `${kind} leave, ${formatDayRange(input.fromDate, input.toDate)} (${input.days} ${input.days === 1 ? "day" : "days"})`
  );
}

export function leaveDecidedPush(input: {
  approved: boolean;
  fromDate: Date;
  toDate: Date;
  note?: string | null;
}): PushPayload {
  const range = formatDayRange(input.fromDate, input.toDate);
  return payload(
    "leave_decided",
    "messages",
    input.approved ? "Leave approved" : "Leave not approved",
    input.note ? `${range} — ${input.note}` : `Your leave for ${range}.`
  );
}

export function marksRecordedPush(input: {
  examName: string;
  className: string;
  subject: string;
  enteredByName: string;
  studentCount: number;
}): PushPayload {
  return payload(
    "marks_recorded",
    "home",
    `${input.examName} marks recorded`,
    `${input.className} ${input.subject} — ${input.studentCount} ${
      input.studentCount === 1 ? "student" : "students"
    }, entered by ${input.enteredByName}.`
  );
}

export function calendarEventPush(input: {
  type: string;
  title: string;
  startDate: Date;
  endDate: Date;
}): PushPayload {
  const label = input.type === "EXAM" ? "Exam" : input.type === "MEETING" ? "Meeting" : "Event";
  return payload(
    "calendar_event",
    "calendar",
    `${label}: ${input.title}`,
    formatDayRange(input.startDate, input.endDate)
  );
}

export function holidayPush(input: { reason: string; date: Date }): PushPayload {
  return payload("holiday", "calendar", `Holiday: ${input.reason}`, formatDay(input.date));
}

export function attendanceReminderPush(input: { classNames: string[] }): PushPayload {
  const classes = input.classNames.join(", ");
  return payload(
    "attendance_reminder",
    "home",
    "Attendance not marked",
    input.classNames.length === 1
      ? `${classes} has no attendance for today yet.`
      : `${classes} have no attendance for today yet.`
  );
}

// --- Parent app ------------------------------------------------------------
// Parents reach only the screens their five-tab app has: `messages` for the
// announcement feed and `home` for everything that hangs off the child's
// dashboard. The parent app has no `calendar` or `leave_approval` route it is
// ever sent to here, so these all use the two it does.

export function childAbsentPush(input: { studentName: string; date: Date }): PushPayload {
  const first = input.studentName.trim().split(/\s+/)[0] || "Your child";
  return payload(
    "child_absent",
    "home",
    "Marked absent today",
    `${first} was marked absent on ${formatDay(input.date)}.`
  );
}

export function homeworkAssignedPush(input: {
  subject: string;
  title: string;
  dueDate: Date;
}): PushPayload {
  return payload(
    "homework_assigned",
    "home",
    `New ${input.subject} homework`,
    `${input.title} — due ${formatDay(input.dueDate)}.`
  );
}

export function marksPublishedPush(input: { examName: string; subject: string }): PushPayload {
  return payload(
    "marks_published",
    "home",
    `${input.examName} result out`,
    `${input.subject} marks have been published.`
  );
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "a student";
}

function dayWord(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** A child-leave request landing in the office — staff open the web review list. */
export function studentLeaveSubmittedPush(input: {
  studentName: string;
  fromDate: Date;
  toDate: Date;
  days: number;
}): PushPayload {
  return payload(
    "student_leave_submitted",
    "messages",
    `Leave request for ${firstName(input.studentName)}`,
    `${formatDayRange(input.fromDate, input.toDate)} (${dayWord(input.days)}) — awaiting review.`
  );
}

/** The parent, told their child's leave was approved or declined. */
export function studentLeaveDecidedPush(input: {
  studentName: string;
  approved: boolean;
  fromDate: Date;
  toDate: Date;
  note?: string | null;
}): PushPayload {
  const range = formatDayRange(input.fromDate, input.toDate);
  const who = firstName(input.studentName);
  return payload(
    "student_leave_decided",
    "home",
    input.approved ? "Leave approved" : "Leave not approved",
    input.note ? `${who}'s leave for ${range} — ${input.note}` : `${who}'s leave for ${range}.`
  );
}

export function leavePendingReminderPush(input: { count: number; oldest: Date }): PushPayload {
  return payload(
    "leave_pending_reminder",
    "leave_approval",
    `${input.count} leave ${input.count === 1 ? "request" : "requests"} waiting`,
    `The oldest has been pending since ${formatDay(input.oldest)}.`
  );
}
