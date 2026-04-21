import { AttendanceStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

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

async function assertClassAccess(user: AttendanceUser, classId: string) {
  const classRecord = await prisma.class.findFirst({
    where: {
      id: classId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
    }
  });
  if (!classRecord) throw notFound("Class");
  return classRecord;
}

export async function getMarkingRoster(user: Express.UserContext, classId: string, date: Date) {
  await assertClassAccess(user, classId);
  const normalizedDate = startOfDay(date);
  const [students, existingSession] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId, classId, isActive: true },
      orderBy: [{ rollNumber: "asc" }, { fullName: "asc" }]
    }),
    prisma.attendanceSession.findUnique({
      where: { schoolId_classId_date: { schoolId: user.schoolId, classId, date: normalizedDate } },
      include: { records: true }
    })
  ]);

  return {
    date: normalizedDate,
    canEdit: isAdminRole(user.role) || !existingSession,
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

  await assertClassAccess(user, classId);
  const normalizedDate = startOfDay(date);
  const existingSession = await prisma.attendanceSession.findUnique({
    where: {
      schoolId_classId_date: {
        schoolId: user.schoolId,
        classId,
        date: normalizedDate
      }
    }
  });

  if (existingSession) {
    throw new AppError(409, "Attendance has already been submitted for this class and date", "ATTENDANCE_ALREADY_SUBMITTED");
  }

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

  try {
    return await prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.create({
        data: {
          schoolId: user.schoolId,
          classId,
          date: normalizedDate,
          markedById: user.id,
          notes
        }
      });

      await tx.attendanceRecord.createMany({
        data: records.map((record) => ({
          schoolId: user.schoolId,
          sessionId: session.id,
          studentId: record.studentId,
          status: record.status,
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
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, "Attendance has already been submitted for this class and date", "ATTENDANCE_ALREADY_SUBMITTED");
    }
    throw error;
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
        late: 0
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

  return {
    classId,
    date: formatDate(session.date),
    marked: true,
    attendance,
    summary: {
      total: attendance.length,
      present,
      absent,
      late
    }
  };
}

export async function getStudentMonthlyAttendance(user: AttendanceUser, studentId: string, month: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { class: { schoolId: user.schoolId, classTeacherId: user.id } } : {})
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
  const attended = present + late;

  return {
    studentId: student.id,
    month,
    summary: {
      totalDays: records.length,
      present,
      absent,
      late,
      percentage: percentage(attended, records.length)
    },
    daily: records.map((record) => ({
      date: formatDate(record.session.date),
      status: record.status
    }))
  };
}

export async function getAttendanceDashboard(user: AttendanceUser, date = new Date()) {
  if (!isAdminRole(user.role)) {
    throw new AppError(403, "You do not have permission to view the attendance dashboard", "FORBIDDEN");
  }

  const todayStart = startOfDay(date);
  const todayEnd = endOfDay(date);

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
        date: { gte: todayStart, lte: todayEnd }
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
          date: { gte: todayStart, lte: todayEnd }
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
  const absent = statusCounts.get(AttendanceStatus.ABSENT) ?? 0;
  const totalMarkedStudents = present + absent;

  return {
    totalClasses: classes.length,
    markedClasses: markedClassIds.size,
    pendingClasses: Math.max(classes.length - markedClassIds.size, 0),
    attendancePercentage: percentage(present, totalMarkedStudents),
    students: {
      present,
      absent
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
  const classes = await prisma.class.findMany({
    where: {
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
    },
    include: {
      _count: { select: { students: true } },
      attendanceSessions: {
        where: { schoolId: user.schoolId, date: normalizedDate },
        include: { records: true }
      }
    }
  });

  classes.sort((a, b) => {
    const numA = parseInt(a.name, 10);
    const numB = parseInt(b.name, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
  });

  return classes.map((classRecord) => {
    const session = classRecord.attendanceSessions[0];
    const present = session?.records.filter((record) => record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE).length ?? 0;
    const absent = session?.records.filter((record) => record.status === AttendanceStatus.ABSENT).length ?? 0;
    const total = session?.records.length ?? classRecord._count.students;

    return {
      classId: classRecord.id,
      className: `${classRecord.name}-${classRecord.section}`,
      totalStudents: classRecord._count.students,
      marked: Boolean(session),
      present,
      absent,
      attendancePercentage: total ? Math.round((present / total) * 100) : 0
    };
  });
}

export async function monthlyStudentReport(user: Express.UserContext, studentId: string, month: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {})
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
  const present = records.filter((record) => record.status !== AttendanceStatus.ABSENT).length;
  const absent = records.filter((record) => record.status === AttendanceStatus.ABSENT).length;

  return {
    student,
    month,
    totalMarkedDays: records.length,
    present,
    absent,
    percentage: records.length ? Math.round((present / records.length) * 100) : 0,
    records
  };
}
