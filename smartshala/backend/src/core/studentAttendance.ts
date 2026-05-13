export type StudentAttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export type StudentAttendanceRecord = {
  status: StudentAttendanceStatus;
  session: { date: Date };
};

export type StudentAttendanceSummary = {
  attendancePercentage: number;
  totalDays: number;
  absences: number;
  late: number;
  attended: number;
  remainingBefore75: number;
  lastAbsentDate: Date | null;
};

export function calculateStudentAttendanceSummary(records: StudentAttendanceRecord[]): StudentAttendanceSummary {
  const totalDays = records.length;
  const absences = records.filter((record) => record.status === "ABSENT").length;
  const late = records.filter((record) => record.status === "LATE").length;
  const attended = records.filter((record) => record.status !== "ABSENT").length;
  const attendancePercentage = totalDays ? Math.round((attended / totalDays) * 100) : 0;
  const remainingBefore75 = totalDays ? Math.max(0, Math.floor((attended / 0.75) - totalDays)) : 0;
  const lastAbsentDate =
    records
      .filter((record) => record.status === "ABSENT")
      .sort((a, b) => b.session.date.getTime() - a.session.date.getTime())[0]?.session.date ?? null;

  return {
    attendancePercentage,
    totalDays,
    absences,
    late,
    attended,
    remainingBefore75,
    lastAbsentDate
  };
}
