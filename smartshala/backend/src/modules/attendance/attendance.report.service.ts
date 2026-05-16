import { AttendanceStatus, NotificationKind } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { endOfDay, startOfDay } from "./attendance.service.js";
import { sendMessage as sendWhatsAppMessage } from "../whatsapp/whatsapp.service.js";

type AttendanceReportUser = Pick<Express.UserContext, "schoolId">;

type ClassesTodayReportRow = {
  classId: string;
  className: string;
  marked: boolean;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  attended: number;
  total: number;
  percentage: number;
  classTeacherName: string | null;
};

function percentage(attended: number, total: number) {
  if (total === 0) return 0;
  return Math.round((attended / total) * 1000) / 10;
}

function classSort(left: { name: string; section: string }, right: { name: string; section: string }) {
  const leftNumber = parseInt(left.name, 10);
  const rightNumber = parseInt(right.name, 10);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.name.localeCompare(right.name) || left.section.localeCompare(right.section);
}

function reportRange(dateFrom = new Date(), dateTo = dateFrom) {
  return {
    start: startOfDay(dateFrom),
    end: endOfDay(dateTo)
  };
}

function reportDateLabel(start: Date, end: Date) {
  const format = (date: Date) => date.toISOString().slice(0, 10);
  const startLabel = format(start);
  const endLabel = format(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

export async function getClassesTodayReport(user: AttendanceReportUser, dateFrom = new Date(), dateTo = dateFrom): Promise<ClassesTodayReportRow[]> {
  const { start, end } = reportRange(dateFrom, dateTo);

  const [classes, sessions] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: {
        id: true,
        name: true,
        section: true,
        classTeacher: { select: { fullName: true } }
      }
    }),
    prisma.attendanceSession.findMany({
      where: {
        schoolId: user.schoolId,
        date: { gte: start, lte: end }
      },
      select: {
        id: true,
        classId: true
      }
    })
  ]);

  const sessionIds = sessions.map((session) => session.id);
  const groupedRecords =
    sessionIds.length === 0
      ? []
      : await prisma.attendanceRecord.groupBy({
          by: ["sessionId", "status"],
          where: {
            schoolId: user.schoolId,
            sessionId: { in: sessionIds }
          },
          _count: { _all: true }
        });

  const classIdBySessionId = new Map(sessions.map((session) => [session.id, session.classId]));
  const countsByClassId = new Map<string, Record<AttendanceStatus, number>>();

  for (const recordGroup of groupedRecords) {
    const classId = classIdBySessionId.get(recordGroup.sessionId);
    if (!classId) continue;

    const counts =
      countsByClassId.get(classId) ??
      ({
        [AttendanceStatus.PRESENT]: 0,
        [AttendanceStatus.ABSENT]: 0,
        [AttendanceStatus.LATE]: 0,
        [AttendanceStatus.HALF_DAY]: 0
      } satisfies Record<AttendanceStatus, number>);

    counts[recordGroup.status] = recordGroup._count._all;
    countsByClassId.set(classId, counts);
  }

  return classes.sort(classSort).map((classRecord) => {
    const counts = countsByClassId.get(classRecord.id) ?? {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.LATE]: 0,
      [AttendanceStatus.HALF_DAY]: 0
    };
    const present = counts[AttendanceStatus.PRESENT];
    const absent = counts[AttendanceStatus.ABSENT];
    const late = counts[AttendanceStatus.LATE];
    const halfDay = counts[AttendanceStatus.HALF_DAY];
    const attended = present + late + (halfDay * 0.5);
    const total = present + absent + late + halfDay;

    return {
      classId: classRecord.id,
      className: `${classRecord.name}${classRecord.section}`,
      marked: countsByClassId.has(classRecord.id),
      present,
      absent,
      late,
      halfDay,
      attended,
      total,
      percentage: percentage(attended, total),
      classTeacherName: classRecord.classTeacher?.fullName ?? null
    };
  });
}

export async function nudgePendingTeachers(user: AttendanceReportUser, dateFrom = new Date(), dateTo = dateFrom) {
  const { start, end } = reportRange(dateFrom, dateTo);
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      schoolId: user.schoolId,
      date: { gte: start, lte: end }
    },
    select: { classId: true }
  });
  const markedClassIds = new Set(sessions.map((session) => session.classId));
  const pendingClasses = await prisma.class.findMany({
    where: {
      schoolId: user.schoolId,
      id: { notIn: [...markedClassIds] },
      classTeacher: { isNot: null }
    },
    select: {
      name: true,
      section: true,
      classTeacher: { select: { fullName: true, phone: true } }
    },
    orderBy: [{ name: "asc" }, { section: "asc" }]
  });

  const dateLabel = reportDateLabel(start, end);
  let sentCount = 0;

  for (const classRecord of pendingClasses) {
    const phone = classRecord.classTeacher?.phone?.trim();
    if (!phone) continue;
    const className = `${classRecord.name}-${classRecord.section}`;
    const message = `Reminder: attendance for Class ${className} is still pending for ${dateLabel}. Please mark it in SmartShala.`;
    const result = await sendWhatsAppMessage(phone, message, {
      schoolId: user.schoolId,
      kind: NotificationKind.SCHOOL_ALERT
    });
    if (result.success) sentCount += 1;
  }

  return {
    pendingCount: pendingClasses.length,
    sentCount
  };
}
