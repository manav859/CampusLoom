import { AttendanceStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { dailyReport } from "../attendance/attendance.service.js";
import { dashboard as feesDashboard } from "../fees/fees.service.js";
import { riskSummary } from "../analytics/analytics.service.js";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getDashboard(user: Express.UserContext) {
  if (user.role === UserRole.TEACHER) return teacherDashboard(user);
  return principalDashboard(user);
}

async function principalDashboard(user: Express.UserContext) {
  const today = startOfToday();
  const [studentCount, classCount, attendance, feeSummary, risks, absentToday] = await Promise.all([
    prisma.student.count({ where: { schoolId: user.schoolId, isActive: true } }),
    prisma.class.count({ where: { schoolId: user.schoolId } }),
    dailyReport(user, today),
    feesDashboard(user.schoolId),
    riskSummary(user),
    prisma.attendanceRecord.count({
      where: { schoolId: user.schoolId, status: AttendanceStatus.ABSENT, session: { date: today } }
    })
  ]);

  const markedClasses = attendance.filter((item) => item.marked).length;
  const totalPresent = attendance.reduce((sum, item) => sum + item.present, 0);
  const totalMarked = attendance.reduce((sum, item) => sum + item.present + item.absent, 0);

  return {
    role: user.role,
    kpis: {
      totalStudents: studentCount,
      totalClasses: classCount,
      todayAttendancePercentage: totalMarked ? Math.round((totalPresent / totalMarked) * 100) : 0,
      classesMarked: markedClasses,
      classesPending: Math.max(classCount - markedClasses, 0),
      absentToday,
      totalFeesPending: feeSummary.totalPending,
      overdueInstallments: feeSummary.overdueInstallments
    },
    attendance,
    feeSummary,
    alerts: risks.studentRisks.slice(0, 8),
    aiSummary: risks.principalSummary
  };
}

async function teacherDashboard(user: Express.UserContext) {
  const today = startOfToday();
  const [classes, attendance, absentToday] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: user.schoolId, classTeacherId: user.id },
      include: { _count: { select: { students: true } } }
    }),
    dailyReport(user, today),
    prisma.attendanceRecord.count({
      where: {
        schoolId: user.schoolId,
        status: AttendanceStatus.ABSENT,
        session: { date: today, class: { classTeacherId: user.id } }
      }
    })
  ]);
  const pending = attendance.filter((item) => !item.marked);
  
  classes.sort((a, b) => {
    const numA = parseInt(a.name, 10);
    const numB = parseInt(b.name, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
  });

  return {
    role: "TEACHER",
    kpis: {
      assignedClasses: classes.length,
      assignedStudents: classes.reduce((sum, classRecord) => sum + classRecord._count.students, 0),
      absentToday,
      pendingAttendance: pending.length
    },
    classes,
    attendance,
    alerts: pending.map((item) => ({ type: "ATTENDANCE_PENDING", message: `${item.className} attendance is not submitted yet.` }))
  };
}

export async function monthlyTrends(schoolId: string) {
  const paymentAgg = await prisma.payment.groupBy({
    by: ["paidAt"],
    where: { schoolId },
    _sum: { amount: true },
    orderBy: { paidAt: "asc" },
    take: 30
  });
  return {
    feeCollection: paymentAgg.map((item) => ({ date: item.paidAt, amount: Number(item._sum.amount ?? new Prisma.Decimal(0)) }))
  };
}
