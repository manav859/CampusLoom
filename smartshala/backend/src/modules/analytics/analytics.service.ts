import { AttendanceStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../core/prisma.js";

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfWeek(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday + offsetWeeks * 7));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function moneySeverity(pendingFees: number) {
  if (pendingFees >= 10_000) return "FEE_PENDING";
  if (pendingFees > 0) return "FEE_WATCH";
  return null;
}

export async function riskSummary(user: Express.UserContext) {
  const since = startOfMonth();
  const thisWeekStart = startOfWeek();
  const previousWeekStart = startOfWeek(-1);
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
      parentPhone: true,
      class: { select: { name: true, section: true } }
    }
  });
  if (students.length === 0) {
    return {
      generatedAt: new Date(),
      lowAttendanceCount: 0,
      combinedRiskCount: 0,
      repeatAbsenteeCount: 0,
      severityCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      trends: {
        lowAttendance: { current: 0, previous: 0, delta: 0, direction: "flat" },
        totalRisk: { current: 0, previous: 0, delta: 0, direction: "flat" }
      },
      principalSummary: "0 students are below the 75% attendance threshold this month.",
      studentRisks: []
    };
  }

  const scopedStudentWhere = user.role === UserRole.TEACHER ? { class: { classTeacherId: user.id } } : {};
  const [attendanceGroups, previousWeekAttendanceGroups, feeGroups] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: {
        schoolId: user.schoolId,
        student: { schoolId: user.schoolId, isActive: true, ...scopedStudentWhere },
        session: { date: { gte: since } }
      },
      _count: { _all: true }
    }),
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: {
        schoolId: user.schoolId,
        student: { schoolId: user.schoolId, isActive: true, ...scopedStudentWhere },
        session: { date: { gte: previousWeekStart, lt: thisWeekStart } }
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

  function attendanceMap(groups: typeof attendanceGroups) {
    const map = new Map<string, { absent: number; marked: number }>();
    for (const group of groups) {
      const current = map.get(group.studentId) ?? { absent: 0, marked: 0 };
      current.marked += group._count._all;
      if (group.status === AttendanceStatus.ABSENT) current.absent += group._count._all;
      map.set(group.studentId, current);
    }
    return map;
  }

  const attendanceByStudent = attendanceMap(attendanceGroups);
  const previousWeekAttendanceByStudent = attendanceMap(previousWeekAttendanceGroups);

  function buildRisk(student: (typeof students)[number], attendance: { absent: number; marked: number } | undefined) {
    const marked = attendance?.marked ?? 0;
    const absent = attendance?.absent ?? 0;
    const present = marked - absent;
    const attendancePercentage = marked ? Math.round((present / marked) * 100) : 100;
    const pendingFees = feesByStudent.get(student.id) ?? 0;
    const flags = [
      attendancePercentage < 75 ? "LOW_ATTENDANCE" : attendancePercentage < 85 ? "ATTENDANCE_WATCH" : null,
      absent >= 3 ? "REPEAT_ABSENTEE" : absent > 0 ? "ABSENCE_WATCH" : null,
      moneySeverity(pendingFees)
    ].filter(Boolean) as string[];
    const majorFlags = flags.filter((flag) => !flag.endsWith("_WATCH"));
    const severity = majorFlags.length >= 2 || attendancePercentage < 60 ? "HIGH" : majorFlags.length === 1 ? "MEDIUM" : flags.length > 0 ? "LOW" : "NONE";

    return {
      attendancePercentage,
      absentThisMonth: absent,
      pendingFees,
      flags,
      severity
    };
  }

  const feesByStudent = new Map(feeGroups.map((group) => [group.studentId, Number(group._sum.pendingAmount ?? 0)]));

  const previousWeekRisks = students.map((student) => buildRisk(student, previousWeekAttendanceByStudent.get(student.id))).filter((risk) => risk.flags.length > 0);
  const previousLowAttendanceCount = previousWeekRisks.filter((risk) => risk.flags.includes("LOW_ATTENDANCE")).length;

  const studentRisks = students
    .map((student) => {
      const risk = buildRisk(student, attendanceByStudent.get(student.id));
      const explainers = [
        `Attendance ${risk.attendancePercentage}% from current-month records`,
        `${risk.absentThisMonth} absences this month`,
        risk.pendingFees > 0 ? `Pending fees Rs. ${risk.pendingFees.toFixed(2)}` : "No pending fee balance"
      ];
      return {
        studentId: student.id,
        studentName: student.fullName,
        parentPhone: student.parentPhone,
        className: `${student.class.name}-${student.class.section}`,
        attendancePercentage: risk.attendancePercentage,
        absentThisMonth: risk.absentThisMonth,
        pendingFees: risk.pendingFees,
        flags: risk.flags,
        severity: risk.severity,
        explainers
      };
    })
    .filter((item) => item.flags.length > 0)
    .sort((a, b) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
      return rank[b.severity as keyof typeof rank] - rank[a.severity as keyof typeof rank] || a.attendancePercentage - b.attendancePercentage;
    });

  const lowAttendanceCount = studentRisks.filter((risk) => risk.flags.includes("LOW_ATTENDANCE")).length;
  const combinedRiskCount = studentRisks.filter((risk) => risk.flags.includes("LOW_ATTENDANCE") && risk.flags.includes("FEE_PENDING")).length;
  const severityCounts = {
    HIGH: studentRisks.filter((risk) => risk.severity === "HIGH").length,
    MEDIUM: studentRisks.filter((risk) => risk.severity === "MEDIUM").length,
    LOW: studentRisks.filter((risk) => risk.severity === "LOW").length
  };
  const totalRiskDelta = studentRisks.length - previousWeekRisks.length;
  const lowAttendanceDelta = lowAttendanceCount - previousLowAttendanceCount;

  function trend(current: number, previous: number, delta: number) {
    return { current, previous, delta, direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
  }

  return {
    generatedAt: new Date(),
    lowAttendanceCount,
    combinedRiskCount,
    repeatAbsenteeCount: studentRisks.filter((risk) => risk.flags.includes("REPEAT_ABSENTEE")).length,
    severityCounts,
    trends: {
      lowAttendance: trend(lowAttendanceCount, previousLowAttendanceCount, lowAttendanceDelta),
      totalRisk: trend(studentRisks.length, previousWeekRisks.length, totalRiskDelta)
    },
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
