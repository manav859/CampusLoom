import { AttendanceStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function riskSummary(user: Express.UserContext) {
  const since = startOfMonth();
  const students = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      ...(user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {})
    },
    include: {
      class: true,
      attendanceRecords: { where: { session: { date: { gte: since } } } },
      feeAssignments: { where: { pendingAmount: { gt: new Prisma.Decimal(0) } } }
    }
  });

  const studentRisks = students
    .map((student) => {
      const marked = student.attendanceRecords.length;
      const absent = student.attendanceRecords.filter((record) => record.status === AttendanceStatus.ABSENT).length;
      const present = marked - absent;
      const attendancePercentage = marked ? Math.round((present / marked) * 100) : 100;
      const pendingFees = student.feeAssignments.reduce((sum, item) => sum + Number(item.pendingAmount), 0);
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

