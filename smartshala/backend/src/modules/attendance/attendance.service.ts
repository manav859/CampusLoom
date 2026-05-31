import { AttendanceStatus, NotificationKind, Prisma, UserRole } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";
import { buildAttendanceAbsentMessage } from "../whatsapp/templates.js";
import { sendMessage as sendWhatsAppMessage } from "../whatsapp/whatsapp.service.js";

type AttendanceUser = Pick<Express.UserContext, "id" | "schoolId" | "role">;

type AttendanceRecordInput = {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
};

export type MarkAttendanceInput = {
  classId: string;
  date: Date;
  notes?: string;
  records: AttendanceRecordInput[];
  user: AttendanceUser;
};

type AbsentAttendanceNotificationInput = {
  schoolId: string;
  classId: string;
  className: string;
  date: Date;
  absentStudentIds: string[];
};

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = startOfDay(new Date(year, monthNumber - 1, 1));
  const end = endOfDay(new Date(year, monthNumber, 0));
  return { start, end };
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function attendanceValue(status: AttendanceStatus) {
  if (status === AttendanceStatus.ABSENT) return 0;
  if (status === AttendanceStatus.HALF_DAY) return 0.5;
  return 1;
}

function isAdminRole(role: UserRole) {
  return role === UserRole.PRINCIPAL || role === UserRole.ADMIN;
}

function findDuplicateStudentIds(records: AttendanceRecordInput[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    if (seen.has(record.studentId)) duplicates.add(record.studentId);
    seen.add(record.studentId);
  }

  return [...duplicates];
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function teacherClassAccessWhere(user: AttendanceUser) {
  return user.role === UserRole.TEACHER
    ? { OR: [{ classTeacherId: user.id }, { teacherPeriodAssignments: { some: { teacherId: user.id } } }] }
    : {};
}

async function assertClassAccess(user: AttendanceUser, classId: string) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id: classId,
      schoolId: user.schoolId,
      ...teacherClassAccessWhere(user)
    }
  });
  if (!classRecord) throw notFound("Class");
  return classRecord;
}

export async function getMarkingRoster(user: Express.UserContext, classId: string, date: Date) {
  const classRecord = await assertClassAccess(user, classId);
  const normalizedDate = startOfDay(date);
  const [students, existingSession, holiday] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId, classId, isActive: true },
      orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
    }),
    prisma.attendanceSession.findUnique({
      where: { schoolId_classId_date: { schoolId: user.schoolId, classId, date: normalizedDate } },
      include: { records: true }
    }),
    prisma.holiday.findUnique({
      where: { schoolId_date: { schoolId: user.schoolId, date: normalizedDate } }
    }).catch((err: unknown) => {
      console.error("Prisma holiday error:", err);
      return null;
    })
  ]);

  const isSunday = normalizedDate.getDay() === 0;

  return {
    date: formatDate(normalizedDate),
    className: `${classRecord.name}-${classRecord.section}`,
    canEdit: !isSunday && !holiday,
    isHoliday: isSunday || Boolean(holiday),
    holidayReason: isSunday ? "Sunday" : holiday?.reason,
    session: existingSession,
    students: students.map((student) => ({
      ...student,
      defaultStatus: AttendanceStatus.PRESENT,
      savedStatus: existingSession?.records.find((record) => record.studentId === student.id)?.status
    }))
  };
}

export async function markAttendance({ classId, date, notes, records, user }: MarkAttendanceInput) {
  if (records.length === 0) {
    throw new AppError(400, "Attendance records are required", "ATTENDANCE_RECORDS_REQUIRED");
  }

  const duplicateStudentIds = findDuplicateStudentIds(records);
  if (duplicateStudentIds.length > 0) {
    throw new AppError(400, "Attendance contains duplicate students", "DUPLICATE_ATTENDANCE_STUDENTS", {
      studentIds: duplicateStudentIds
    });
  }

  const classRecord = await assertClassAccess(user, classId);
  const normalizedDate = startOfDay(date);
  const submittedStudentIds = records.map((record) => record.studentId);
  const validStudents = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      classId,
      id: { in: submittedStudentIds },
      isActive: true
    },
    select: { id: true }
  });

  const validStudentIds = new Set(validStudents.map((student) => student.id));
  const invalidStudentIds = submittedStudentIds.filter((studentId) => !validStudentIds.has(studentId));

  if (invalidStudentIds.length > 0) {
    throw new AppError(400, "Attendance contains students outside this class or school", "INVALID_ATTENDANCE_STUDENTS", {
      studentIds: invalidStudentIds
    });
  }

  const createdSession = await prisma.$transaction(async (tx) => {
    const session = await tx.attendanceSession.upsert({
      where: {
        schoolId_classId_date: {
          schoolId: user.schoolId,
          classId,
          date: normalizedDate
        }
      },
      update: {
        markedById: user.id,
        notes,
        submittedAt: new Date()
      },
      create: {
        schoolId: user.schoolId,
        classId,
        date: normalizedDate,
        markedById: user.id,
        notes
      }
    });

    await tx.attendanceRecord.deleteMany({
      where: {
        schoolId: user.schoolId,
        sessionId: session.id,
        studentId: { in: submittedStudentIds }
      }
    });

    await tx.attendanceRecord.createMany({
      data: records.map((record) => ({
        schoolId: user.schoolId,
        sessionId: session.id,
        studentId: record.studentId,
        status: record.status,
        attendanceValue: attendanceValue(record.status),
        remarks: record.remarks
      }))
    });

    const createdSession = await tx.attendanceSession.findFirst({
      where: { id: session.id, schoolId: user.schoolId },
      include: {
        records: true,
        class: true,
        markedBy: { select: { id: true, fullName: true } }
      }
    });

    if (!createdSession) throw notFound("Attendance session");
    return createdSession;
  }, { timeout: 15000 });

  queueAbsentAttendanceNotifications({
    schoolId: user.schoolId,
    classId,
    className: `${classRecord.name}-${classRecord.section}`,
    date: normalizedDate,
    absentStudentIds: records.filter((record) => record.status === AttendanceStatus.ABSENT).map((record) => record.studentId)
  });

  return createdSession;
}

function queueAbsentAttendanceNotifications(input: AbsentAttendanceNotificationInput) {
  const absentStudentIds = [...new Set(input.absentStudentIds)];
  if (absentStudentIds.length === 0) return;

  setImmediate(() => {
    void sendAbsentAttendanceNotifications({ ...input, absentStudentIds });
  });
}

async function sendAbsentAttendanceNotifications(input: AbsentAttendanceNotificationInput) {
  const students = await prisma.student.findMany({
    where: {
      schoolId: input.schoolId,
      classId: input.classId,
      id: { in: input.absentStudentIds }
    },
    select: {
      id: true,
      fullName: true,
      parentPhone: true
    }
  });

  const attendanceDate = formatDate(input.date);

  for (const student of students) {
    const phone = student.parentPhone.trim();
    if (!phone) continue;

    const message = buildAttendanceAbsentMessage(student.fullName, input.className, attendanceDate);

    try {
      await sendWhatsAppMessage(phone, message, {
        schoolId: input.schoolId,
        studentId: student.id,
        kind: NotificationKind.ABSENCE
      });
    } catch (error) {
      logger.warn(
        {
          err: error,
          schoolId: input.schoolId,
          studentId: student.id
        },
        "Failed to send attendance WhatsApp notification"
      );
    }
  }
}

export async function getClassTodayAttendance(user: AttendanceUser, classId: string, date = new Date()) {
  await assertClassAccess(user, classId);
  const today = startOfDay(date);

  const session = await prisma.attendanceSession.findUnique({
    where: {
      schoolId_classId_date: {
        schoolId: user.schoolId,
        classId,
        date: today
      }
    },
    select: {
      id: true,
      classId: true,
      date: true,
      records: {
        where: { schoolId: user.schoolId },
        select: {
          status: true,
          attendanceValue: true,
          student: {
            select: {
              id: true,
              fullName: true,
              rollNumber: true
            }
          }
        }
      }
    }
  });

  if (!session) {
    return {
      classId,
      date: formatDate(today),
      marked: false,
      attendance: [],
      summary: {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        attended: 0
      }
    };
  }

  const attendance = session.records
    .map((record) => ({
      studentId: record.student.id,
      name: record.student.fullName,
      rollNumber: record.student.rollNumber,
      status: record.status
    }))
    .sort((left, right) => (left.rollNumber ?? Number.MAX_SAFE_INTEGER) - (right.rollNumber ?? Number.MAX_SAFE_INTEGER));

  const present = attendance.filter((record) => record.status === AttendanceStatus.PRESENT).length;
  const absent = attendance.filter((record) => record.status === AttendanceStatus.ABSENT).length;
  const late = attendance.filter((record) => record.status === AttendanceStatus.LATE).length;
  const halfDay = attendance.filter((record) => record.status === AttendanceStatus.HALF_DAY).length;
  const attended = session.records.reduce((sum, record) => sum + Number(record.attendanceValue), 0);

  return {
    classId,
    date: formatDate(session.date),
    marked: true,
    attendance,
    summary: {
      total: attendance.length,
      present,
      absent,
      late,
      halfDay,
      attended
    }
  };
}

export async function getStudentMonthlyAttendance(user: AttendanceUser, studentId: string, month: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { class: { schoolId: user.schoolId, ...teacherClassAccessWhere(user) } } : {})
    },
    select: { id: true }
  });

  if (!student) throw notFound("Student");

  const { start, end } = monthRange(month);
  const records = await prisma.attendanceRecord.findMany({
    where: {
      schoolId: user.schoolId,
      studentId: student.id,
      session: {
        schoolId: user.schoolId,
        date: { gte: start, lte: end }
      }
    },
    select: {
      status: true,
      attendanceValue: true,
      session: {
        select: { date: true }
      }
    },
    orderBy: {
      session: { date: "asc" }
    }
  });

  const present = records.filter((record) => record.status === AttendanceStatus.PRESENT).length;
  const absent = records.filter((record) => record.status === AttendanceStatus.ABSENT).length;
  const late = records.filter((record) => record.status === AttendanceStatus.LATE).length;
  const halfDay = records.filter((record) => record.status === AttendanceStatus.HALF_DAY).length;
  const attended = records.reduce((sum, record) => sum + Number(record.attendanceValue), 0);

  return {
    studentId: student.id,
    month,
    summary: {
      totalDays: records.length,
      present,
      absent,
      late,
      halfDay,
      attended,
      percentage: percentage(attended, records.length)
    },
    daily: records.map((record) => ({
      date: formatDate(record.session.date),
      status: record.status
    }))
  };
}

export async function getClassMonthlyAttendance(user: AttendanceUser, classId: string, month: string) {
  const classRecord = await assertClassAccess(user, classId);
  const { start, end } = monthRange(month);
  const [students, sessions, holidays] = await Promise.all([
    prisma.student.count({ where: { schoolId: user.schoolId, classId, isActive: true } }),
    prisma.attendanceSession.findMany({
      where: {
        schoolId: user.schoolId,
        classId,
        date: { gte: start, lte: end }
      },
      include: { records: { select: { status: true } } },
      orderBy: { date: "asc" }
    }),
    prisma.holiday.findMany({
      where: {
        schoolId: user.schoolId,
        date: { gte: start, lte: end }
      }
    }).catch((err: unknown) => {
      console.error("Prisma holiday list error:", err);
      return [];
    })
  ]);

  const holidaysMap = new Map(holidays.map(h => [formatDate(h.date), h]));

  const days: { date: string; marked: boolean; total: number; present: number; late: number; halfDay: number; absent: number; attended: number; percentage: number; isHoliday?: boolean; holidayReason?: string }[] = sessions.map((session) => {
    const present = session.records.filter((record) => record.status === AttendanceStatus.PRESENT).length;
    const late = session.records.filter((record) => record.status === AttendanceStatus.LATE).length;
    const halfDay = session.records.filter((record) => record.status === AttendanceStatus.HALF_DAY).length;
    const absent = session.records.filter((record) => record.status === AttendanceStatus.ABSENT).length;
    const attended = session.records.reduce((sum, record) => sum + attendanceValue(record.status), 0);
    const total = session.records.length || students;
    const formattedDate = formatDate(session.date);
    const holiday = holidaysMap.get(formattedDate);
    const isSunday = session.date.getDay() === 0;

    return {
      date: formattedDate,
      marked: true,
      total,
      present,
      late,
      halfDay,
      absent,
      attended,
      percentage: percentage(attended, total),
      isHoliday: isSunday || Boolean(holiday),
      holidayReason: isSunday ? "Sunday" : holiday?.reason
    };
  });

  const sessionDates = new Set(days.map(d => d.date));
  for (const holiday of holidays) {
    const formattedDate = formatDate(holiday.date);
    if (!sessionDates.has(formattedDate)) {
      days.push({
        date: formattedDate,
        marked: false,
        total: 0,
        present: 0,
        late: 0,
        halfDay: 0,
        absent: 0,
        attended: 0,
        percentage: 0,
        isHoliday: true,
        holidayReason: holiday.reason
      });
    }
  }

  return {
    classId,
    className: `${classRecord.name}-${classRecord.section}`,
    month,
    totalStudents: students,
    days: days.sort((a, b) => a.date.localeCompare(b.date))
  };
}

export async function getAttendanceDashboard(user: AttendanceUser, dateFrom = new Date(), dateTo = dateFrom) {
  if (!isAdminRole(user.role)) {
    throw new AppError(403, "You do not have permission to view the attendance dashboard", "FORBIDDEN");
  }

  const rangeStart = startOfDay(dateFrom);
  const rangeEnd = endOfDay(dateTo);

  const [classes, sessions, groupedRecords] = await Promise.all([
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
        date: { gte: rangeStart, lte: rangeEnd }
      },
      select: {
        id: true,
        classId: true
      }
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        schoolId: user.schoolId,
        session: {
          schoolId: user.schoolId,
          date: { gte: rangeStart, lte: rangeEnd }
        }
      },
      _count: { _all: true }
    })
  ]);

  const markedClassIds = new Set(sessions.map((session) => session.classId));
  
  classes.sort((a, b) => {
    const numA = parseInt(a.name, 10);
    const numB = parseInt(b.name, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
  });

  const statusCounts = new Map(groupedRecords.map((item) => [item.status, item._count._all]));
  const present = (statusCounts.get(AttendanceStatus.PRESENT) ?? 0) + (statusCounts.get(AttendanceStatus.LATE) ?? 0);
  const halfDay = statusCounts.get(AttendanceStatus.HALF_DAY) ?? 0;
  const attended = present + (halfDay * 0.5);
  const absent = statusCounts.get(AttendanceStatus.ABSENT) ?? 0;
  const totalMarkedStudents = present + absent + halfDay;

  return {
    totalClasses: classes.length,
    markedClasses: markedClassIds.size,
    pendingClasses: Math.max(classes.length - markedClassIds.size, 0),
    attendancePercentage: percentage(attended, totalMarkedStudents),
    students: {
      present,
      absent,
      halfDay,
      attended
    },
    alerts: classes
      .filter((classRecord) => !markedClassIds.has(classRecord.id))
      .map((classRecord) => ({
        type: "MISSING_ATTENDANCE",
        classId: classRecord.id,
        className: `${classRecord.name}${classRecord.section}`
      }))
  };
}

export async function dailyReport(user: Express.UserContext, date = new Date()) {
  const normalizedDate = startOfDay(date);
  const classWhere = {
    schoolId: user.schoolId,
    ...teacherClassAccessWhere(user)
  };
  const [classes, sessions] = await Promise.all([
    prisma.class.findMany({
      where: classWhere,
      select: {
        id: true,
        name: true,
        section: true,
        _count: { select: { students: true } }
      }
    }),
    prisma.attendanceSession.findMany({
      where: {
        schoolId: user.schoolId,
        date: normalizedDate,
        ...(user.role === UserRole.TEACHER ? { class: teacherClassAccessWhere(user) } : {})
      },
      select: { id: true, classId: true }
    })
  ]);
  const sessionByClass = new Map(sessions.map((session) => [session.classId, session.id]));
  const recordGroups = sessions.length
    ? await prisma.attendanceRecord.groupBy({
        by: ["sessionId", "status"],
        where: {
          schoolId: user.schoolId,
          sessionId: { in: sessions.map((session) => session.id) }
        },
        _count: { _all: true }
      })
    : [];
  const countsBySession = new Map<string, Map<AttendanceStatus, number>>();
  for (const group of recordGroups) {
    const counts = countsBySession.get(group.sessionId) ?? new Map<AttendanceStatus, number>();
    counts.set(group.status, group._count._all);
    countsBySession.set(group.sessionId, counts);
  }

  classes.sort((a, b) => {
    const numA = parseInt(a.name, 10);
    const numB = parseInt(b.name, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
  });

  return classes.map((classRecord) => {
    const sessionId = sessionByClass.get(classRecord.id);
    const counts = sessionId ? countsBySession.get(sessionId) : undefined;
    const present = (counts?.get(AttendanceStatus.PRESENT) ?? 0) + (counts?.get(AttendanceStatus.LATE) ?? 0);
    const halfDay = counts?.get(AttendanceStatus.HALF_DAY) ?? 0;
    const absent = counts?.get(AttendanceStatus.ABSENT) ?? 0;
    const totalMarked = present + halfDay + absent;
    const attended = present + (halfDay * 0.5);
    const total = totalMarked || classRecord._count.students;

    return {
      classId: classRecord.id,
      className: `${classRecord.name}-${classRecord.section}`,
      totalStudents: classRecord._count.students,
      marked: Boolean(sessionId),
      present,
      halfDay,
      attended,
      absent,
      attendancePercentage: total ? Math.round((attended / total) * 100) : 0
    };
  });
}

export async function monthlyStudentReport(user: Express.UserContext, studentId: string, month: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { class: teacherClassAccessWhere(user) } : {})
    }
  });
  if (!student) throw notFound("Student");

  const { start, end } = monthRange(month);
  const records = await prisma.attendanceRecord.findMany({
    where: {
      schoolId: user.schoolId,
      studentId,
      session: { schoolId: user.schoolId, date: { gte: start, lte: end } }
    },
    include: { session: true },
    orderBy: { session: { date: "asc" } }
  });
  const present = records.filter((record) => record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE).length;
  const halfDay = records.filter((record) => record.status === AttendanceStatus.HALF_DAY).length;
  const attended = records.reduce((sum, record) => sum + attendanceValue(record.status), 0);
  const absent = records.filter((record) => record.status === AttendanceStatus.ABSENT).length;

  return {
    student,
    month,
    totalMarkedDays: records.length,
    present,
    halfDay,
    attended,
    absent,
    percentage: records.length ? Math.round((attended / records.length) * 100) : 0,
    records
  };
}

export async function createHoliday(user: AttendanceUser, date: Date, reason: string) {
  if (!isAdminRole(user.role)) {
    throw new AppError(403, "You do not have permission to create holidays", "FORBIDDEN");
  }

  const normalizedDate = startOfDay(date);

  const existingSession = await prisma.attendanceSession.findFirst({
    where: { schoolId: user.schoolId, date: normalizedDate }
  });

  if (existingSession) {
    throw new AppError(400, "Cannot create holiday on a date with marked attendance. Reset attendance first.", "ATTENDANCE_EXISTS");
  }

  try {
    const holiday = await prisma.holiday.create({
      data: {
        schoolId: user.schoolId,
        date: normalizedDate,
        reason
      }
    });
    return holiday;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(400, "Holiday already exists for this date", "DUPLICATE_HOLIDAY");
    }
    throw error;
  }
}

export async function listHolidays(user: AttendanceUser, month: string) {
  const { start, end } = monthRange(month);
  
  const holidays = await prisma.holiday.findMany({
    where: {
      schoolId: user.schoolId,
      date: { gte: start, lte: end }
    },
    orderBy: { date: "asc" }
  }).catch((err: unknown) => {
    console.error("Prisma holiday list error:", err);
    return [];
  });

  return holidays;
}

export async function deleteHoliday(user: AttendanceUser, holidayId: string) {
  if (!isAdminRole(user.role)) {
    throw new AppError(403, "You do not have permission to delete holidays", "FORBIDDEN");
  }

  try {
    await prisma.holiday.delete({
      where: {
        id: holidayId,
        schoolId: user.schoolId
      }
    });
  } catch (error) {
    throw notFound("Holiday");
  }
}
