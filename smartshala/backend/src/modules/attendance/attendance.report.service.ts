import { AttendanceStatus } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { startOfDay } from "./attendance.service.js";

type AttendanceReportUser = Pick<Express.UserContext, "schoolId">;

type ClassesTodayReportRow = {
  classId: string;
  className: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
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

export async function getClassesTodayReport(user: AttendanceReportUser): Promise<ClassesTodayReportRow[]> {
  const today = startOfDay(new Date());

  const [classes, sessions] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: {
        id: true,
        name: true,
        section: true
      }
    }),
    prisma.attendanceSession.findMany({
      where: {
        schoolId: user.schoolId,
        date: today
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
        [AttendanceStatus.LATE]: 0
      } satisfies Record<AttendanceStatus, number>);

    counts[recordGroup.status] = recordGroup._count._all;
    countsByClassId.set(classId, counts);
  }

  return classes.sort(classSort).map((classRecord) => {
    const counts = countsByClassId.get(classRecord.id) ?? {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.LATE]: 0
    };
    const present = counts[AttendanceStatus.PRESENT];
    const absent = counts[AttendanceStatus.ABSENT];
    const late = counts[AttendanceStatus.LATE];
    const total = present + absent + late;

    return {
      classId: classRecord.id,
      className: `${classRecord.name}${classRecord.section}`,
      present,
      absent,
      late,
      total,
      percentage: percentage(present + late, total)
    };
  });
}
