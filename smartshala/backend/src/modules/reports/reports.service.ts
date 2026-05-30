import { dailyReport, monthlyStudentReport } from "../attendance/attendance.service.js";
import { defaulters } from "../fees/fees.service.js";
import { classPerformance, riskSummary } from "../analytics/analytics.service.js";

export async function dailyPrincipalReport(user: Express.UserContext, date = new Date()) {
  const [attendance, risks] = await Promise.all([dailyReport(user, date), riskSummary(user)]);
  return {
    date,
    attendance,
    absentStudentsNeedsFollowup: risks.studentRisks.filter((risk) => risk.flags.includes("REPEAT_ABSENTEE")),
    aiSummary: risks.principalSummary
  };
}

export async function monthlyStudent(user: Express.UserContext, studentId: string, month: string) {
  return monthlyStudentReport(user, studentId, month);
}

export async function feePending(schoolId: string) {
  return defaulters(schoolId);
}

export async function risk(user: Express.UserContext) {
  return riskSummary(user);
}

export async function classReport(user: Express.UserContext) {
  return classPerformance(user);
}

export async function examReport(user: Express.UserContext, query: any) {
  const { prisma } = await import("../../core/prisma.js");
  const schoolId = user.schoolId;

  const classIds = query.classIds ? query.classIds.split(",").filter(Boolean) : undefined;
  const examIds = query.examIds ? query.examIds.split(",").filter(Boolean) : undefined;
  const subjectIds = query.subjectIds ? query.subjectIds.split(",").filter(Boolean) : undefined;

  const where: any = { schoolId };

  if (classIds?.length) {
    where.exam = { ...where.exam, classId: { in: classIds } };
  }
  
  if (examIds?.length) {
    where.examId = { in: examIds };
  }

  if (subjectIds?.length) {
    where.subjectId = { in: subjectIds };
  }

  const results = await prisma.examResult.findMany({
    where,
    include: {
      student: { select: { fullName: true, admissionNumber: true } },
      exam: { include: { class: { select: { name: true, section: true } } } },
      subjectRef: { select: { name: true } }
    },
    orderBy: [
      { exam: { examDate: "desc" } },
      { student: { fullName: "asc" } }
    ]
  });

  return results.map(r => ({
    id: r.id,
    studentName: r.student.fullName,
    admissionNumber: r.student.admissionNumber,
    className: r.exam?.class ? `${r.exam.class.name}-${r.exam.class.section}` : "N/A",
    examName: r.exam?.name || r.assessmentName,
    subjectName: r.subjectRef?.name || r.subject || "N/A",
    maxMarks: Number(r.maxMarks),
    marksObtained: Number(r.marksObtained),
    percentage: r.percentage ? Number(r.percentage) : null,
    grade: r.grade || "N/A"
  }));
}

