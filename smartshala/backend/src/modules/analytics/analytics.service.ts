import { AttendanceStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function riskSummary(user: Express.UserContext) {
  const since = startOfMonth();
  const studentWhere = {
    schoolId: user.schoolId,
    isActive: true,
    ...(user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {})
  };

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      fullName: true,
      class: { select: { name: true, section: true } }
    }
  });
  if (students.length === 0) {
    return {
      generatedAt: new Date(),
      lowAttendanceCount: 0,
      combinedRiskCount: 0,
      repeatAbsenteeCount: 0,
      principalSummary: "0 students are below the 75% attendance threshold this month.",
      studentRisks: []
    };
  }

  const scopedStudentWhere = user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {};
  const [attendanceGroups, feeGroups] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: {
        schoolId: user.schoolId,
        student: { schoolId: user.schoolId, isActive: true, ...scopedStudentWhere },
        session: { date: { gte: since } }
      },
      _count: { _all: true }
    }),
    prisma.studentFeeAssignment.groupBy({
      by: ["studentId"],
      where: {
        schoolId: user.schoolId,
        student: { schoolId: user.schoolId, isActive: true, ...scopedStudentWhere },
        pendingAmount: { gt: new Prisma.Decimal(0) }
      },
      _sum: { pendingAmount: true }
    })
  ]);

  const attendanceByStudent = new Map<string, { absent: number; marked: number }>();
  for (const group of attendanceGroups) {
    const current = attendanceByStudent.get(group.studentId) ?? { absent: 0, marked: 0 };
    current.marked += group._count._all;
    if (group.status === AttendanceStatus.ABSENT) current.absent += group._count._all;
    attendanceByStudent.set(group.studentId, current);
  }

  const feesByStudent = new Map(feeGroups.map((group) => [group.studentId, Number(group._sum.pendingAmount ?? 0)]));

  const studentRisks = students
    .map((student) => {
      const attendance = attendanceByStudent.get(student.id);
      const marked = attendance?.marked ?? 0;
      const absent = attendance?.absent ?? 0;
      const present = marked - absent;
      const attendancePercentage = marked ? Math.round((present / marked) * 100) : 100;
      const pendingFees = feesByStudent.get(student.id) ?? 0;
      const flags = [
        attendancePercentage < 75 ? "LOW_ATTENDANCE" : null,
        absent >= 3 ? "REPEAT_ABSENTEE" : null,
        pendingFees > 0 ? "FEE_PENDING" : null
      ].filter(Boolean);

      return {
        studentId: student.id,
        studentName: student.fullName,
        className: `${student.class.name}-${student.class.section}`,
        attendancePercentage,
        absentThisMonth: absent,
        pendingFees,
        flags,
        severity: flags.length >= 2 ? "HIGH" : flags.length === 1 ? "MEDIUM" : "LOW"
      };
    })
    .filter((item) => item.flags.length > 0)
    .sort((a, b) => b.flags.length - a.flags.length || a.attendancePercentage - b.attendancePercentage);

  const lowAttendanceCount = studentRisks.filter((risk) => risk.flags.includes("LOW_ATTENDANCE")).length;
  const combinedRiskCount = studentRisks.filter((risk) => risk.flags.includes("LOW_ATTENDANCE") && risk.flags.includes("FEE_PENDING")).length;

  return {
    generatedAt: new Date(),
    lowAttendanceCount,
    combinedRiskCount,
    repeatAbsenteeCount: studentRisks.filter((risk) => risk.flags.includes("REPEAT_ABSENTEE")).length,
    principalSummary:
      combinedRiskCount > 0
        ? `${combinedRiskCount} students need priority follow-up for both low attendance and pending fees.`
        : `${lowAttendanceCount} students are below the 75% attendance threshold this month.`,
    studentRisks: studentRisks.slice(0, 25)
  };
}

export async function classPerformance(user: Express.UserContext) {
  const since = startOfMonth();
  const classes = await prisma.class.findMany({
    where: {
      schoolId: user.schoolId,
      ...(user.role === UserRole.TEACHER ? { classTeacherId: user.id } : {})
    },
    include: {
      attendanceSessions: { where: { date: { gte: since } }, include: { records: true } },
      _count: { select: { students: true } }
    }
  });

  return classes.map((classRecord) => {
    const records = classRecord.attendanceSessions.flatMap((session) => session.records);
    const present = records.filter((record) => record.status !== AttendanceStatus.ABSENT).length;
    const percentage = records.length ? Math.round((present / records.length) * 100) : 0;
    return {
      classId: classRecord.id,
      className: `${classRecord.name}-${classRecord.section}`,
      studentCount: classRecord._count.students,
      markedDays: classRecord.attendanceSessions.length,
      attendancePercentage: percentage,
      status: percentage < 75 ? "Needs attention" : percentage < 85 ? "Watch" : "Healthy"
    };
  });
}
