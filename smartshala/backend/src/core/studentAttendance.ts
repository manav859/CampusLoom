export type StudentAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY";

export type StudentAttendanceRecord = {
  status: StudentAttendanceStatus;
  attendanceValue?: unknown;
  session: { date: Date };
};

export type StudentAttendanceSummary = {
  attendancePercentage: number;
  totalDays: number;
  absences: number;
  late: number;
  halfDays: number;
  attended: number;
  remainingBefore75: number;
  lastAbsentDate: Date | null;
};

export function calculateStudentAttendanceSummary(records: StudentAttendanceRecord[]): StudentAttendanceSummary {
  const schoolDayRecords = records.filter((record) => record.session.date.getDay() !== 0);
  const totalDays = schoolDayRecords.length;
  const absences = schoolDayRecords.filter((record) => record.status === "ABSENT").length;
  const late = schoolDayRecords.filter((record) => record.status === "LATE").length;
  const halfDays = schoolDayRecords.filter((record) => record.status === "HALF_DAY").length;
  const attended = schoolDayRecords.reduce((sum, record) => {
    if (record.attendanceValue !== undefined && record.attendanceValue !== null) return sum + Number(record.attendanceValue);
    if (record.status === "ABSENT") return sum;
    if (record.status === "HALF_DAY") return sum + 0.5;
    return sum + 1;
  }, 0);
  const attendancePercentage = totalDays ? Math.round((attended / totalDays) * 100) : 0;
  const remainingBefore75 = totalDays ? Math.max(0, Math.floor((attended / 0.75) - totalDays)) : 0;
  const lastAbsentDate =
    records
      .filter((record) => record.status === "ABSENT" && record.session.date.getDay() !== 0)
      .sort((a, b) => b.session.date.getTime() - a.session.date.getTime())[0]?.session.date ?? null;

  return {
    attendancePercentage,
    totalDays,
    absences,
    late,
    halfDays,
    attended,
    remainingBefore75,
    lastAbsentDate
  };
}
