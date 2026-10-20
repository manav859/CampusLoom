import type { AnnouncementAudience, AnnouncementPriority, CalendarEventType, LeaveType } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import {
  announcementPush,
  announcementRoles,
  approverRoles,
  calendarEventPush,
  holidayPush,
  leaveDecidedPush,
  leaveSubmittedPush,
  marksRecordedPush,
  staffRoles
} from "./push.messages.js";
import { dispatch, notifyUsers, userIdsWithRoles } from "./push.service.js";

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
    const recipients = await userIdsWithRoles(user.schoolId, announcementRoles(announcement.audience), {
      exclude: user.id
    });
    await notifyUsers(
      user.schoolId,
      recipients,
      announcementPush({
        title: announcement.title,
        body: announcement.body,
        isUrgent: announcement.priority === "URGENT"
      })
    );
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

export function notifyHoliday(
  user: Pick<Express.UserContext, "id" | "schoolId">,
  holiday: { reason: string; date: Date }
) {
  dispatch(async () => {
    const recipients = await userIdsWithRoles(user.schoolId, staffRoles, { exclude: user.id });
    await notifyUsers(user.schoolId, recipients, holidayPush(holiday));
  });
}
