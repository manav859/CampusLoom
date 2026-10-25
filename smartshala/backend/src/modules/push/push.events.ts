import { AnnouncementAudience, type AnnouncementPriority, type CalendarEventType, type LeaveType } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { GUARDIAN_PHONE_FIELDS, normalizePhone } from "../../utils/parentPhone.js";
import {
  announcementPush,
  announcementRoles,
  approverRoles,
  attendanceReminderPush,
  calendarEventPush,
  childAbsentPush,
  holidayPush,
  homeworkAssignedPush,
  leaveDecidedPush,
  leaveSubmittedPush,
  marksPublishedPush,
  marksRecordedPush,
  staffRoles,
  studentLeaveDecidedPush,
  studentLeaveSubmittedPush
} from "./push.messages.js";
import { dispatch, notifyAllParents, notifyParentPhones, notifyUsers, userIdsWithRoles } from "./push.service.js";

/** The guardian phone columns to pull so {@link guardianPhones} can read them. */
const GUARDIAN_PHONE_SELECT = {
  parentPhone: true,
  alternatePhone: true,
  fatherPhone: true,
  motherPhone: true,
  guardianPhone: true
} as const;

type GuardianPhones = Partial<Record<(typeof GUARDIAN_PHONE_FIELDS)[number], string | null>>;

/** The valid last-ten-digit mobiles a student's parents can be reached on. */
function guardianPhones(student: GuardianPhones): string[] {
  return GUARDIAN_PHONE_FIELDS.map((field) => normalizePhone(student[field])).filter(
    (phone) => phone.length === 10
  );
}

/** Every guardian phone across an active class — for a class-wide parent push. */
async function classGuardianPhones(schoolId: string, classId: string): Promise<string[]> {
  const students = await prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: GUARDIAN_PHONE_SELECT
  });
  return students.flatMap(guardianPhones);
}

/**
 * One function per event a feature module can announce. Each returns
 * immediately: the lookup and the delivery happen after the response, so a
 * module adds a notification with a single line and cannot slow its own
 * endpoint down or fail it.
 *
 * The author of an action is always excluded. Nobody needs their own phone to
 * tell them what they just did.
 */

export function notifyAnnouncementPosted(
  user: Express.UserContext,
  announcement: {
    title: string;
    body: string;
    audience: AnnouncementAudience;
    priority: AnnouncementPriority;
  }
) {
  dispatch(async () => {
    const message = announcementPush({
      title: announcement.title,
      body: announcement.body,
      isUrgent: announcement.priority === "URGENT"
    });

    const recipients = await userIdsWithRoles(user.schoolId, announcementRoles(announcement.audience), {
      exclude: user.id
    });
    await notifyUsers(user.schoolId, recipients, message);

    // A notice addressed to parents (or to everyone) reaches the parent app as
    // well. There is no per-parent recipient list — every parent device in the
    // school is a valid target — so these go to all of them.
    if (
      announcement.audience === AnnouncementAudience.PARENTS ||
      announcement.audience === AnnouncementAudience.ALL
    ) {
      await notifyAllParents(user.schoolId, message);
    }
  });
}

export function notifyLeaveSubmitted(
  user: Express.UserContext,
  leave: { applicantName: string; type: LeaveType; fromDate: Date; toDate: Date; days: number }
) {
  dispatch(async () => {
    // A principal applying for their own leave still needs the other approvers
    // to hear about it, hence the exclusion rather than a role check.
    const recipients = await userIdsWithRoles(user.schoolId, approverRoles, { exclude: user.id });
    await notifyUsers(user.schoolId, recipients, leaveSubmittedPush(leave));
  });
}

export function notifyLeaveDecided(
  user: Express.UserContext,
  decision: {
    applicantId: string;
    approved: boolean;
    fromDate: Date;
    toDate: Date;
    note?: string | null;
  }
) {
  dispatch(async () => {
    await notifyUsers(user.schoolId, [decision.applicantId], leaveDecidedPush(decision));
  });
}

export function notifyMarksRecorded(
  user: Express.UserContext,
  exam: {
    classId: string;
    examName: string;
    className: string;
    subject: string;
    studentCount: number;
  }
) {
  dispatch(async () => {
    const [approvers, classRecord] = await Promise.all([
      userIdsWithRoles(user.schoolId, approverRoles, { exclude: user.id }),
      prisma.class.findFirst({
        where: { id: exam.classId, schoolId: user.schoolId },
        select: { classTeacherId: true }
      })
    ]);

    // The class teacher is told when a subject teacher enters marks for their
    // class; they are not told about their own entry, and not told twice if
    // they happen to be an approver as well.
    const recipients = new Set(approvers);
    if (classRecord?.classTeacherId && classRecord.classTeacherId !== user.id) {
      recipients.add(classRecord.classTeacherId);
    }

    await notifyUsers(
      user.schoolId,
      [...recipients],
      marksRecordedPush({ ...exam, enteredByName: user.fullName })
    );

    // The parents of that class hear that a result is out — never the marks
    // themselves, which they open in the app.
    const phones = await classGuardianPhones(user.schoolId, exam.classId);
    await notifyParentPhones(
      user.schoolId,
      phones,
      marksPublishedPush({ examName: exam.examName, subject: exam.subject })
    );
  });
}

/**
 * The parents of the children just marked absent. One push per child, to that
 * child's own guardians — a parent with two children absent gets two, each
 * naming the right one.
 */
export function notifyChildrenAbsent(
  user: Pick<Express.UserContext, "schoolId">,
  input: { studentIds: string[]; date: Date }
) {
  if (input.studentIds.length === 0) return;
  dispatch(async () => {
    const students = await prisma.student.findMany({
      where: { schoolId: user.schoolId, id: { in: input.studentIds } },
      select: { fullName: true, ...GUARDIAN_PHONE_SELECT }
    });
    for (const student of students) {
      await notifyParentPhones(
        user.schoolId,
        guardianPhones(student),
        childAbsentPush({ studentName: student.fullName, date: input.date })
      );
    }
  });
}

/** Approvers, told a parent has raised a leave request for their child. */
export function notifyStudentLeaveSubmitted(
  user: Pick<Express.UserContext, "schoolId">,
  leave: { studentName: string; fromDate: Date; toDate: Date; days: number }
) {
  dispatch(async () => {
    const recipients = await userIdsWithRoles(user.schoolId, approverRoles);
    await notifyUsers(user.schoolId, recipients, studentLeaveSubmittedPush(leave));
  });
}

/** The parent who raised it, told whether the child's leave was granted. */
export function notifyStudentLeaveDecided(
  schoolId: string,
  parentPhone: string,
  decision: { studentName: string; approved: boolean; fromDate: Date; toDate: Date; note?: string | null }
) {
  dispatch(async () => {
    await notifyParentPhones(schoolId, [parentPhone], studentLeaveDecidedPush(decision));
  });
}

/** The parents of a class, told that new homework has been set for it. */
export function notifyHomeworkAssigned(
  user: Pick<Express.UserContext, "schoolId">,
  homework: { classId: string; subject: string; title: string; dueDate: Date }
) {
  dispatch(async () => {
    const phones = await classGuardianPhones(user.schoolId, homework.classId);
    await notifyParentPhones(
      user.schoolId,
      phones,
      homeworkAssignedPush({ subject: homework.subject, title: homework.title, dueDate: homework.dueDate })
    );
  });
}

export function notifyCalendarEvent(
  user: Express.UserContext,
  event: { type: CalendarEventType; title: string; startDate: Date; endDate: Date }
) {
  dispatch(async () => {
    const recipients = await userIdsWithRoles(user.schoolId, staffRoles, { exclude: user.id });
    await notifyUsers(user.schoolId, recipients, calendarEventPush(event));
  });
}

/**
 * A principal pressing "nudge" on the attendance report. Each pending class
 * teacher is pushed the same reminder the daily worker would send — one
 * notification per teacher, listing the classes of theirs still unmarked.
 */
export function notifyAttendanceNudge(
  schoolId: string,
  teachers: { teacherId: string; classNames: string[] }[]
) {
  dispatch(async () => {
    for (const { teacherId, classNames } of teachers) {
      await notifyUsers(schoolId, [teacherId], attendanceReminderPush({ classNames }));
    }
  });
}

export function notifyHoliday(
  user: Pick<Express.UserContext, "id" | "schoolId">,
  holiday: { reason: string; date: Date }
) {
  dispatch(async () => {
    const recipients = await userIdsWithRoles(user.schoolId, staffRoles, { exclude: user.id });
    await notifyUsers(user.schoolId, recipients, holidayPush(holiday));
  });
}
