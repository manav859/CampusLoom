"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StudentDetail } from "@/lib/api";

export type AttendanceTabPanelProps = {
  student: StudentDetail;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function statusLabel(status: StudentDetail["attendanceAnalytics"]["calendar"][number]["status"]) {
  if (status === "PRESENT") return "Present";
  if (status === "ABSENT") return "Absent";
  if (status === "LATE") return "Late";
  if (status === "HOLIDAY") return "Holiday";
  return "Unmarked";
}

function statusClasses(status: StudentDetail["attendanceAnalytics"]["calendar"][number]["status"]) {
  if (status === "PRESENT") return "bg-[#34c759] text-white/60";
  if (status === "ABSENT") return "bg-[#ff3b30] text-white/60";
  if (status === "LATE") return "bg-[#ff9500] text-white/70";
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

function remainingCardClasses(attendancePercentage: number) {
  if (attendancePercentage < 70) {
    return "border-[#ff3b30]/20 bg-gradient-to-br from-[#ff3b30]/15 to-[#ff3b30]/5";
  }
  if (attendancePercentage < 80) {
    return "border-[#ff9500]/20 bg-gradient-to-br from-[#ff9500]/15 to-[#ff9500]/5";
  }
  return "border-[rgba(0,0,0,0.04)] bg-white";
}

function remainingValueColor(attendancePercentage: number) {
  if (attendancePercentage < 70) return "text-[#c90011]";
  if (attendancePercentage < 80) return "text-[#cc7700]";
  return "text-[#1d1d1f]";
}

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
  const presentDays = metrics.totalDays - metrics.absences;

  return (
    <section className="space-y-4">
      {analytics.cbseWarning ? (
        <div className="rounded-[18px] border border-[#ff3b30]/20 bg-[#ff3b30]/[0.08] p-5 shadow-apple-sm">
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
          <div className="flex flex-col justify-between rounded-[20px] border border-[rgba(0,0,0,0.04)] bg-white p-4 sm:p-5 shadow-apple-sm transition-all hover:shadow-apple">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] sm:text-[11px]">Attendance %</p>
              <p className="mt-1.5 text-[26px] font-bold tracking-tight text-[#1d1d1f] sm:text-[32px]">{metrics.attendancePercentage}%</p>
            </div>
            <div className="mt-3">
              <StatusPill label={metrics.attendancePercentage >= 80 ? "Healthy" : "Watch"} tone={metricTone(metrics.attendancePercentage)} />
            </div>
          </div>

          {/* Total days — present/total format */}
          <div className="flex flex-col justify-between rounded-[20px] border border-[rgba(0,0,0,0.04)] bg-white p-4 sm:p-5 shadow-apple-sm transition-all hover:shadow-apple">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] sm:text-[11px]">Total days</p>
              <p className="mt-1.5 text-[26px] font-bold tracking-tight text-[#1d1d1f] sm:text-[32px]">
                <span className="text-[#248a3d]">{presentDays}</span>
                <span className="mx-0.5 font-medium text-[#aeaeb2]">/</span>
                <span>{metrics.totalDays}</span>
              </p>
            </div>
            <p className="mt-3 text-[11px] font-medium text-[#86868b] sm:text-[12px]">{metrics.late} late marks</p>
          </div>

          {/* Absences */}
          <div className="flex flex-col justify-between rounded-[20px] border border-[rgba(0,0,0,0.04)] bg-white p-4 sm:p-5 shadow-apple-sm transition-all hover:shadow-apple">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] sm:text-[11px]">Absences</p>
              <p className="mt-1.5 text-[26px] font-bold tracking-tight text-[#c90011] sm:text-[32px]">{metrics.absences}</p>
            </div>
          </div>

          {/* Remaining before 75% */}
          <div className={`flex flex-col justify-between rounded-[20px] border p-4 sm:p-5 shadow-apple-sm transition-all hover:shadow-apple ${remainingCardClasses(metrics.attendancePercentage)}`}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] sm:text-[11px]">Buffer to 75%</p>
              <p className={`mt-1.5 text-[26px] font-bold tracking-tight sm:text-[32px] ${remainingValueColor(metrics.attendancePercentage)}`}>
                {metrics.remainingBefore75}
              </p>
            </div>
            <p className="mt-3 text-[11px] font-medium text-[#86868b] sm:text-[12px]">additional absences</p>
          </div>
        </div>

        {/* Right Side: Calendar Card (7 columns) */}
        <section className="flex flex-col rounded-[24px] border border-[rgba(0,0,0,0.04)] bg-gradient-to-b from-[#fbfbfd] to-white p-5 sm:p-6 shadow-apple lg:col-span-7">
          <div className="flex flex-col gap-4 border-b border-[rgba(0,0,0,0.06)] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Calendar</h2>
              <select
                className="cursor-pointer rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f] shadow-sm outline-none transition-all hover:border-[#0071e3] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
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
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-black/10 bg-[#f5f5f7]" /> Holiday</div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-x-auto pt-6 pb-2">
            <div className="inline-grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekdays.map((day) => (
                <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#86868b]" key={day}>{day}</div>
              ))}
              {calendarSlots.map((slot) => {
                if (slot.type === "blank") return <div key={slot.id} className="h-8 w-8 rounded-[8px] bg-transparent sm:h-10 sm:w-10" />;
                const date = new Date(slot.date);
                return (
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-[8px] shadow-sm ring-1 ring-inset ring-black/[0.04] transition-all duration-200 hover:scale-110 hover:shadow-md sm:h-10 sm:w-10 ${statusClasses(slot.status)}`}
                    key={slot.date}
                    title={`${dateLabel(slot.date)} - ${statusLabel(slot.status)}`}
                  >
                    <span className="text-[13px] font-bold sm:text-[15px]">{date.getDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      {/* ── Pattern detection ── */}
      <section className="rounded-[24px] border border-[rgba(0,0,0,0.04)] bg-white p-5 sm:p-6 shadow-apple">
        <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Pattern detection</h2>
        <div className="mt-5 space-y-3">
          {analytics.repeatedWeekdayAbsences.length === 0 ? (
            <div className="flex items-center justify-center rounded-[16px] border border-dashed border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.01)] py-8 text-[13px] font-medium text-[#86868b]">
              No repeated weekday absence pattern detected. All good!
            </div>
          ) : (
            analytics.repeatedWeekdayAbsences.map((pattern) => (
              <div className="rounded-[16px] bg-[#ff9500]/[0.08] p-4 ring-1 ring-inset ring-[#ff9500]/20" key={pattern.weekday}>
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
