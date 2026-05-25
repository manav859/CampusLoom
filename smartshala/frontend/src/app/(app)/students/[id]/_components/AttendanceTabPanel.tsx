"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StudentDetail } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";

export type AttendanceTabPanelProps = {
  student: StudentDetail;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateLabel(value: string) {
  return formatDateShort(value);
}

function statusLabel(status: StudentDetail["attendanceAnalytics"]["calendar"][number]["status"]) {
  if (status === "PRESENT") return "Present";
  if (status === "ABSENT") return "Absent";
  if (status === "LATE") return "Late";
  if (status === "HALF_DAY") return "Half day";
  if (status === "HOLIDAY") return "Holiday";
  return "Unmarked";
}

function statusClasses(status: StudentDetail["attendanceAnalytics"]["calendar"][number]["status"]) {
  if (status === "PRESENT") return "bg-[#34c759] text-white/60";
  if (status === "ABSENT") return "bg-[#ff3b30] text-white/60";
  if (status === "LATE") return "bg-[#ff9500] text-white/70";
  if (status === "HALF_DAY") return "bg-[#7c3aed] text-white/70";
  if (status === "HOLIDAY") return "bg-[#f5f5f7] text-[#1d1d1f]/30";
  return "bg-[rgba(0,0,0,0.02)] text-[#1d1d1f]/20";
}

function metricTone(value: number) {
  if (value >= 80) return "good";
  if (value >= 75) return "warn";
  return "danger";
}

/* ── Helpers to derive month options from calendar data ── */

type MonthOption = { key: string; label: string; year: number; month: number };

function getAvailableMonths(calendar: StudentDetail["attendanceAnalytics"]["calendar"]): MonthOption[] {
  const seen = new Map<string, MonthOption>();
  for (const day of calendar) {
    const d = new Date(day.date);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${m}`;
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        year: y,
        month: m,
      });
    }
  }
  // Sort descending (newest first)
  return [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

/* ── "Remaining before 75%" card color logic ── */

export default function AttendanceTabPanel({ student }: AttendanceTabPanelProps) {
  const analytics = student.attendanceAnalytics;
  const metrics = analytics.metrics;

  /* ── Monthly filter state ── */
  const availableMonths = useMemo(() => getAvailableMonths(analytics.calendar), [analytics.calendar]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("all");

  /* ── Filter calendar days by selected month ── */
  const filteredCalendar = useMemo(() => {
    if (selectedMonthKey === "all") return analytics.calendar;
    const opt = availableMonths.find((m) => m.key === selectedMonthKey);
    if (!opt) return analytics.calendar;
    return analytics.calendar.filter((day) => {
      const d = new Date(day.date);
      return d.getFullYear() === opt.year && d.getMonth() === opt.month;
    });
  }, [analytics.calendar, selectedMonthKey, availableMonths]);

  const firstDayOffset = filteredCalendar.length ? new Date(filteredCalendar[0].date).getDay() : 0;
  const calendarSlots = [
    ...Array.from({ length: firstDayOffset }, (_, index) => ({ type: "blank" as const, id: `blank-${index}` })),
    ...filteredCalendar.map((day) => ({ type: "day" as const, ...day })),
  ];

  /* ── "present / total" for the Total Days card ── */
  const presentDays = metrics.attended ?? (metrics.totalDays - metrics.absences - (metrics.halfDays * 0.5));
  const absentDates = useMemo(
    () =>
      analytics.records
        .filter((record) => record.status === "ABSENT")
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [analytics.records]
  );

  return (
    <section className="space-y-4">
      {analytics.cbseWarning ? (
        <div className="rounded-[6px] border border-[#F1B8BD] bg-[#FFF7F8] p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#c90011]">CBSE attendance warning</p>
              <p className="mt-1 text-[15px] font-semibold text-[#1d1d1f]">
                Attendance is below 80%. Immediate follow-up is recommended.
              </p>
            </div>
            <StatusPill label={`${metrics.attendancePercentage}% attendance`} tone="danger" />
          </div>
        </div>
      ) : null}

      {/* ── Main Bento Grid ── */}
      <div className="grid gap-4 lg:grid-cols-12">
        
        {/* Left Side: 2x2 Metrics Grid (5 columns) */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-5">
          {/* Attendance % */}
          <div className="kpi-metric-card flex flex-col justify-between p-4 sm:p-5">
            <div>
              <p className="kpi-metric-label">Attendance %</p>
              <p className="kpi-metric-value">{metrics.attendancePercentage}%</p>
            </div>
            <div className="mt-3">
              <StatusPill label={metrics.attendancePercentage >= 80 ? "Healthy" : "Watch"} tone={metricTone(metrics.attendancePercentage)} />
            </div>
            {metrics.classAverageAttendance !== null ? (
              <p className="mt-3 text-[11px] font-medium text-[#86868b] sm:text-[12px]">
                Class average: <span className="font-semibold text-[#1d1d1f]">{metrics.classAverageAttendance}%</span>
              </p>
            ) : null}
          </div>

          {/* Total days — present/total format */}
          <div className="kpi-metric-card kpi-metric-card-good flex flex-col justify-between p-4 sm:p-5">
            <div>
              <p className="kpi-metric-label">Total days</p>
              <p className="kpi-metric-value">
                <span className="text-[#248a3d]">{presentDays}</span>
                <span className="mx-0.5 font-medium text-[#aeaeb2]">/</span>
                <span>{metrics.totalDays}</span>
              </p>
            </div>
            <p className="mt-3 text-[11px] font-medium text-[#86868b] sm:text-[12px]">{metrics.late} late, {metrics.halfDays} half-day</p>
          </div>

          {/* Absences */}
          <div className="kpi-metric-card kpi-metric-card-danger flex flex-col justify-between p-4 sm:p-5">
            <div>
              <p className="kpi-metric-label">Absences</p>
              <p className="kpi-metric-value">{metrics.absences}</p>
            </div>
          </div>

          {/* Remaining before 75% */}
          <div className={`kpi-metric-card flex flex-col justify-between p-4 sm:p-5 ${metrics.attendancePercentage < 75 ? "kpi-metric-card-danger" : "kpi-metric-card-good"}`}>
            <div>
              <p className="kpi-metric-label">Buffer to 75%</p>
              <p className="kpi-metric-value">
                {metrics.remainingBefore75}
              </p>
            </div>
            <p className="mt-3 text-[11px] font-medium text-[#86868b] sm:text-[12px]">additional absences</p>
          </div>
        </div>

        {/* Right Side: Calendar Card (7 columns) */}
        <section className="flex flex-col rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6 lg:col-span-7">
          <div className="flex flex-col gap-4 border-b border-[#E7EBF0] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Calendar</h2>
              <select
                className="cursor-pointer rounded-[6px] border border-[#C9D3DE] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f] outline-none transition-all hover:border-[#2456E6] focus:border-[#2456E6]"
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
              >
                <option value="all">All months</option>
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#6e6e73]">
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34c759] shadow-sm" /> Present</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ff3b30] shadow-sm" /> Absent</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ff9500] shadow-sm" /> Late</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7c3aed] shadow-sm" /> Half day</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-black/10 bg-[#f5f5f7]" /> Holiday</div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-x-auto pt-6 pb-2">
          <div className="inline-grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekdays.map((day) => (
                <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#86868b]" key={day}>{day}</div>
              ))}
              {calendarSlots.map((slot) => {
                if (slot.type === "blank") return <div key={slot.id} className="h-10 w-8 rounded-[8px] bg-transparent sm:h-12 sm:w-10" />;
                const date = new Date(slot.date);
                const letter = slot.status === "PRESENT" ? "P" : slot.status === "ABSENT" ? "A" : slot.status === "LATE" ? "L" : slot.status === "HALF_DAY" ? "HD" : slot.status === "HOLIDAY" ? "H" : "";
                return (
                  <div
                    className={`flex h-10 w-8 flex-col items-center justify-center rounded-[8px] shadow-sm ring-1 ring-inset ring-black/[0.04] transition-all duration-200 hover:scale-110 hover:shadow-md sm:h-12 sm:w-10 ${statusClasses(slot.status)}`}
                    key={slot.date}
                    title={`${dateLabel(slot.date)} - ${statusLabel(slot.status)}`}
                  >
                    <span className="text-[11px] font-bold leading-none sm:text-[13px]">{date.getDate()}</span>
                    {letter ? <span className="mt-0.5 text-[8px] font-bold uppercase leading-none opacity-80 sm:text-[9px]">{letter}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Absent dates</h2>
              <p className="mt-1 text-[13px] text-[#86868b]">Most recent absences from recorded attendance days.</p>
            </div>
            <StatusPill label={`${absentDates.length} absences`} tone={absentDates.length > 0 ? "danger" : "good"} />
          </div>

          <div className="mt-5">
            {absentDates.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] px-4 py-7 text-center text-[13px] font-medium text-[#86868b]">
                No absences recorded in this period.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {absentDates.slice(0, 8).map((record) => (
                  <div className="flex items-center justify-between rounded-[6px] border border-[#F1B8BD] bg-[#FFF7F8] px-4 py-3" key={record.date}>
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">{formatDateShort(record.date)}</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#c90011]">Absent</span>
                  </div>
                ))}
              </div>
            )}
            {absentDates.length > 8 ? (
              <p className="mt-3 text-[12px] font-medium text-[#86868b]">Showing 8 most recent of {absentDates.length} absences.</p>
            ) : null}
          </div>
        </div>

        <aside className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Class context</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-[6px] bg-[#F7F8FB] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">Student</p>
              <p className="mt-1 text-[28px] font-bold leading-none text-[#1d1d1f]">{metrics.attendancePercentage}%</p>
            </div>
            <div className="rounded-[6px] bg-[#E2F0FB] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1F6FB8]">Class average</p>
              <p className="mt-1 text-[28px] font-bold leading-none text-[#0F2557]">
                {metrics.classAverageAttendance === null ? "-" : `${metrics.classAverageAttendance}%`}
              </p>
            </div>
            {metrics.classAverageAttendance !== null ? (
              <p className="text-[13px] font-medium leading-relaxed text-[#5A6573]">
                {metrics.attendancePercentage >= metrics.classAverageAttendance
                  ? `${student.fullName} is at or above class average.`
                  : `${student.fullName} is ${metrics.classAverageAttendance - metrics.attendancePercentage}% below class average.`}
              </p>
            ) : (
              <p className="text-[13px] font-medium leading-relaxed text-[#5A6573]">Class average appears after classmates have recorded attendance.</p>
            )}
          </div>
        </aside>
      </section>

      {/* ── Pattern detection ── */}
      <section className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
        <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Pattern detection</h2>
        <div className="mt-5 space-y-3">
          {analytics.repeatedWeekdayAbsences.length === 0 ? (
            <div className="flex items-center justify-center rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] py-8 text-[13px] font-medium text-[#86868b]">
              No weekly absence pattern detected.
            </div>
          ) : (
            analytics.repeatedWeekdayAbsences.map((pattern) => (
              <div className="rounded-[6px] border border-[#FFE0B3] bg-[#FFF8ED] p-4" key={pattern.weekday}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{pattern.weekday}s</p>
                  <StatusPill label={`${pattern.count} absences`} tone="warn" />
                </div>
                <p className="mt-2.5 text-[12px] font-medium text-[#86868b]">{pattern.dates.map(dateLabel).join("  •  ")}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
