import { AttendanceStatus, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return { start, end };
}

function isAdminRole(role: UserRole) {
  return role === UserRole.PRINCIPAL || role === UserRole.ADMIN;
}

async function assertClassAccess(user: Express.UserContext, classId: string) {
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

export async function markAttendance(
  user: Express.UserContext,
  data: { classId: string; date: Date; notes?: string; records: { studentId: string; status: AttendanceStatus; remarks?: string }[] }
) {
  await assertClassAccess(user, data.classId);
  const normalizedDate = startOfDay(data.date);
  const existingSession = await prisma.attendanceSession.findUnique({
    where: { schoolId_classId_date: { schoolId: user.schoolId, classId: data.classId, date: normalizedDate } }
  });

  if (existingSession && !isAdminRole(user.role)) {
    throw new AppError(409, "Attendance has already been submitted. Ask admin to edit it.", "ATTENDANCE_ALREADY_SUBMITTED");
  }

  const validStudentCount = await prisma.student.count({
    where: {
      schoolId: user.schoolId,
      classId: data.classId,
      id: { in: data.records.map((record) => record.studentId) },
      isActive: true
    }
  });
  if (validStudentCount !== data.records.length) {
    throw new AppError(400, "Attendance contains students outside this class", "INVALID_ATTENDANCE_STUDENTS");
  }

  return prisma.$transaction(async (tx) => {
    const session =
      existingSession ??
      (await tx.attendanceSession.create({
        data: {
          schoolId: user.schoolId,
          classId: data.classId,
          date: normalizedDate,
          markedById: user.id,
          notes: data.notes
        }
      }));

    if (existingSession) {
      await tx.attendanceRecord.deleteMany({ where: { sessionId: existingSession.id } });
      await tx.attendanceSession.update({
        where: { id: existingSession.id },
        data: { markedById: user.id, notes: data.notes, submittedAt: new Date() }
      });
    }

    await tx.attendanceRecord.createMany({
      data: data.records.map((record) => ({
        schoolId: user.schoolId,
        sessionId: session.id,
        studentId: record.studentId,
        status: record.status,
        remarks: record.remarks
      }))
    });

    return tx.attendanceSession.findUnique({
      where: { id: session.id },
      include: { records: true, class: true, markedBy: { select: { id: true, fullName: true } } }
    });
  });
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
        where: { date: normalizedDate },
        include: { records: true }
      }
    },
    orderBy: [{ name: "asc" }, { section: "asc" }]
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
      session: { date: { gte: start, lt: end } }
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
