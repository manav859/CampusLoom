import type { Kpi } from "@/types";
import type { StudentDetail } from "@/lib/api";

export type AttendanceSummary = {
  total: number;
  absent: number;
  percentage: number;
};

export type PerformanceClassification = "Excellent" | "Good" | "Needs Attention" | "At Risk";

export function money(value: string | number) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-IN")}`;
}

export function classLabel(student: StudentDetail) {
  return `${student.class.name}-${student.class.section}`;
}

export function currentMonthAttendance(records: StudentDetail["attendanceRecords"]): AttendanceSummary {
  const now = new Date();
  const currentMonthRecords = records.filter((record) => {
    const date = new Date(record.session.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });

  const scopedRecords = currentMonthRecords.length > 0 ? currentMonthRecords : records;
  const total = scopedRecords.length;
  const attended = scopedRecords.filter((record) => record.status !== "ABSENT").length;
  const absent = scopedRecords.filter((record) => record.status === "ABSENT").length;

  return {
    total,
    absent,
    percentage: total ? Math.round((attended / total) * 100) : 0
  };
}

export function latestAbsentDate(records: StudentDetail["attendanceRecords"]) {
  const absentRecords = records
    .filter((record) => record.status === "ABSENT")
    .sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime());

  return absentRecords[0]?.session.date ?? null;
}

export function daysSinceLastAbsent(lastAbsentDate: string | null) {
  if (!lastAbsentDate) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const absentDate = new Date(lastAbsentDate);
  absentDate.setHours(0, 0, 0, 0);

  const diff = startOfToday.getTime() - absentDate.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function performanceRate(examAverage: number | null, homeworkCompletion: number | null, attendancePercentage: number) {
  if (examAverage === null || homeworkCompletion === null) return null;
  return Math.round((examAverage * 0.6) + (homeworkCompletion * 0.2) + (attendancePercentage * 0.2));
}

export function performanceClassification(rate: number | null): PerformanceClassification | null {
  if (rate === null) return null;
  if (rate >= 85) return "Excellent";
  if (rate >= 70) return "Good";
  if (rate >= 50) return "Needs Attention";
  return "At Risk";
}

export function fallbackPerformanceClassification(attendancePercentage: number, pendingFees: number): PerformanceClassification {
  const risk = riskLabel(attendancePercentage, pendingFees);
  if (risk === "High") return "At Risk";
  if (risk === "Medium") return "Needs Attention";
  return "Good";
}

export function performanceTone(classification: PerformanceClassification) {
  if (classification === "Excellent") return "good";
  if (classification === "Good") return "good";
  if (classification === "Needs Attention") return "warn";
  return "danger";
}

export function riskLabel(attendancePercentage: number, pendingFees: number) {
  if ((attendancePercentage > 0 && attendancePercentage < 75) || pendingFees > 0) return "High";
  if (attendancePercentage > 0 && attendancePercentage < 85) return "Medium";
  return "Low";
}

export function riskTone(risk: string): NonNullable<Kpi["tone"]> {
  if (risk === "High") return "danger";
  if (risk === "Medium") return "warn";
  return "good";
}
