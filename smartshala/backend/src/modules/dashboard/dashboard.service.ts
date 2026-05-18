import { AttendanceStatus, BehaviourSeverity, BehaviourType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { dailyReport } from "../attendance/attendance.service.js";
import { dashboard as feesDashboard } from "../fees/fees.service.js";
import { riskSummary } from "../analytics/analytics.service.js";

const DASHBOARD_CACHE_TTL_MS = 15_000;
const dashboardCache = new Map<string, { expiresAt: number; payload: unknown }>();

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function cacheKey(user: Express.UserContext) {
  return `${user.schoolId}:${user.role}:${user.id}`;
}

export async function getDashboard(user: Express.UserContext) {
  const key = cacheKey(user);
  const cached = dashboardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const payload =
    user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN
      ? await principalDashboard(user)
      : user.role === UserRole.TEACHER
        ? await teacherDashboard(user)
        : user.role === UserRole.ACCOUNTANT
          ? await accountantDashboard(user)
          : await parentDashboard(user);

  dashboardCache.set(key, { expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS, payload });
  return payload;
}

async function accountantDashboard(user: Express.UserContext) {
  const feeSummary = await feesDashboard(user.schoolId);
  return {
    role: user.role,
    kpis: {
      totalFeesPending: feeSummary.totalPending,
      totalFeesCollected: feeSummary.totalCollected,
      overdueInstallments: feeSummary.overdueInstallments
    },
    feeSummary,
    alerts: []
  };
}

async function parentDashboard(user: Express.UserContext) {
  const students = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      OR: [{ parentPhone: user.phone ?? "" }, { alternatePhone: user.phone ?? "" }]
    },
    select: { id: true, fullName: true }
  });

  return {
    role: user.role,
    kpis: {
      linkedStudents: students.length
    },
    students,
    alerts: []
  };
}

async function principalDashboard(user: Express.UserContext) {
  const today = startOfToday();
  const [studentCount, classCount, attendance, feeSummary, risks, absentToday, behaviourActions] = await Promise.all([
    prisma.student.count({ where: { schoolId: user.schoolId, isActive: true } }),
    prisma.class.count({ where: { schoolId: user.schoolId } }),
    dailyReport(user, today),
    feesDashboard(user.schoolId),
    riskSummary(user),
    prisma.attendanceRecord.count({
      where: { schoolId: user.schoolId, status: AttendanceStatus.ABSENT, session: { date: today } }
    }),
    prisma.behaviourRecord.findMany({
      where: {
        schoolId: user.schoolId,
        type: BehaviourType.INCIDENT,
        severity: { in: [BehaviourSeverity.MEDIUM, BehaviourSeverity.HIGH] }
      },
      include: {
        student: { select: { id: true, fullName: true, class: { select: { name: true, section: true } } } },
        createdBy: { select: { fullName: true } }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 5
    })
  ]);

  const markedClasses = attendance.filter((item) => item.marked).length;
  const totalPresent = attendance.reduce((sum, item) => sum + item.present, 0);
  const totalMarked = attendance.reduce((sum, item) => sum + item.present + item.absent, 0);

  const behaviourAlerts = behaviourActions.map((record) => ({
    type: "BEHAVIOUR_INCIDENT",
    studentId: record.student.id,
    studentName: record.student.fullName,
    message: record.title,
    severity: record.severity,
    flags: [
      `${record.student.class.name}-${record.student.class.section}`,
      record.actionTaken ? `Action: ${record.actionTaken}` : record.summary,
      record.createdBy?.fullName ? `Logged by ${record.createdBy.fullName}` : "Logged behaviour"
    ]
  }));
  const dashboardDefaulters = feeSummary.topDefaulters.map((assignment) => {
    const dueDate = assignment.feeStructure.installments?.[0]?.dueDate;
    const daysOverdue = dueDate ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)) : 0;

    return {
      studentId: assignment.studentId,
      name: assignment.student.fullName,
      class: `${assignment.student.class.name}-${assignment.student.class.section}`,
      balance: Number(assignment.pendingAmount),
      balanceAmount: Number(assignment.pendingAmount),
      dueDate,
      daysOverdue,
      status: assignment.status
    };
  });

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
    defaulters: dashboardDefaulters,
    alerts: [...behaviourAlerts, ...risks.studentRisks].slice(0, 8),
    aiSummary: risks.principalSummary
  };
}

async function teacherDashboard(user: Express.UserContext) {
  const today = startOfToday();
  const [classes, attendance, absentToday, pendingHomeworkSubmissions] = await Promise.all([
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
    }),
    prisma.homeworkSubmission.count({
      where: {
        schoolId: user.schoolId,
        status: { in: ["MISSING", "NOT_SUBMITTED"] },
        assignment: {
          OR: [
            { assignedById: user.id },
            { class: { classTeacherId: user.id } },
            { subjectRef: { teacherId: user.id } }
          ]
        }
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
      pendingAttendance: pending.length,
      pendingHomeworkSubmissions
    },
    classes,
    attendance,
    alerts: [
      ...pending.map((item) => ({ type: "ATTENDANCE_PENDING", message: `${item.className} attendance is not submitted yet.`, severity: "MEDIUM" })),
      ...(pendingHomeworkSubmissions > 0
        ? [{ type: "HOMEWORK_PENDING", message: `${pendingHomeworkSubmissions} homework submissions need follow-up.`, severity: "MEDIUM" }]
        : [])
    ]
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
