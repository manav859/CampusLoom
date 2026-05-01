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
  if (status === "PRESENT") return "border-[#34c759]/25 bg-[#34c759]/15 text-[#248a3d]";
  if (status === "ABSENT") return "border-[#ff3b30]/25 bg-[#ff3b30]/15 text-[#c90011]";
  if (status === "LATE") return "border-[#ff9500]/25 bg-[#ff9500]/15 text-[#cc7700]";
  if (status === "HOLIDAY") return "border-[#8e8e93]/20 bg-[#f5f5f7] text-[#6e6e73]";
  return "border-[rgba(0,0,0,0.04)] bg-white text-[#aeaeb2]";
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
        <div className="rounded-2xl border border-[#ff3b30]/20 bg-[#ff3b30]/[0.08] p-5 shadow-apple-sm">
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

      {/* ── Metric cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Attendance % */}
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-4 shadow-apple-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Attendance %</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{metrics.attendancePercentage}%</p>
          <StatusPill label={metrics.attendancePercentage >= 80 ? "Healthy" : "Watch"} tone={metricTone(metrics.attendancePercentage)} />
        </div>

        {/* Total days — present/total format */}
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-4 shadow-apple-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Total days</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            <span className="text-[#248a3d]">{presentDays}</span>
            <span className="text-[#aeaeb2]">/</span>
            <span>{metrics.totalDays}</span>
          </p>
          <p className="mt-1 text-[12px] text-[#86868b]">{metrics.late} late marks</p>
        </div>

        {/* Absences */}
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-4 shadow-apple-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Absences</p>
          <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-[#c90011]">{metrics.absences}</p>
        </div>

        {/* Remaining before 75% — colored based on attendance */}
        <div className={`rounded-2xl border p-4 shadow-apple-sm ${remainingCardClasses(metrics.attendancePercentage)}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Remaining before 75%</p>
          <p className={`mt-1.5 text-[28px] font-semibold tracking-tight ${remainingValueColor(metrics.attendancePercentage)}`}>
            {metrics.remainingBefore75}
          </p>
          <p className="mt-1 text-[12px] text-[#86868b]">additional absences</p>
        </div>
      </div>

      {/* ── Attendance calendar with monthly filter ── */}
      <section className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Attendance calendar</h2>
            {/* Monthly filter dropdown */}
            <select
              className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f5f5f7] px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f] outline-none transition-colors focus:border-[#0071e3] focus:bg-white"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
            >
              <option value="all">All months</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#6e6e73]">
            {["Present", "Absent", "Late", "Holiday"].map((label) => (
              <span className="rounded-md bg-[rgba(0,0,0,0.04)] px-2 py-0.5" key={label}>{label}</span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {weekdays.map((day) => (
            <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#86868b]" key={day}>{day}</div>
          ))}
          {calendarSlots.map((slot) => {
            if (slot.type === "blank") return <div key={slot.id} />;
            const date = new Date(slot.date);
            return (
              <div
                className={`min-h-[56px] rounded-xl border p-1.5 transition-transform duration-200 hover:-translate-y-0.5 ${statusClasses(slot.status)}`}
                key={slot.date}
                title={`${dateLabel(slot.date)} - ${statusLabel(slot.status)}`}
              >
                <p className="text-[11px] font-bold">{date.getDate()}</p>
                <p className="mt-1.5 text-[10px] font-semibold">{statusLabel(slot.status)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Pattern detection — no attendance records table ── */}
      <section className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Pattern detection</h2>
        <div className="mt-4 space-y-3">
          {analytics.repeatedWeekdayAbsences.length === 0 ? (
            <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">
              No repeated weekday absence pattern detected.
            </div>
          ) : (
            analytics.repeatedWeekdayAbsences.map((pattern) => (
              <div className="rounded-xl bg-[#ff9500]/[0.08] p-4" key={pattern.weekday}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{pattern.weekday}</p>
                  <StatusPill label={`${pattern.count} absences`} tone="warn" />
                </div>
                <p className="mt-2 text-[12px] text-[#86868b]">{pattern.dates.map(dateLabel).join(", ")}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
