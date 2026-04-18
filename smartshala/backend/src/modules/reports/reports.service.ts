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

