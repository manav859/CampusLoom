"use client";

import { useState } from "react";
import { staffAttendanceApi, type LeavePage, type LeaveRequest, type StaffMonthDayStatus, type StaffMonthSummary, type TeacherDetail } from "@/lib/api";

type TabKey = "overview" | "timetable" | "attendance" | "leave" | "documents";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "timetable", label: "Timetable" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "documents", label: "Documents" }
];

const weekdays = [
  { id: "MONDAY", short: "Mon" },
  { id: "TUESDAY", short: "Tue" },
  { id: "WEDNESDAY", short: "Wed" },
  { id: "THURSDAY", short: "Thu" },
  { id: "FRIDAY", short: "Fri" },
  { id: "SATURDAY", short: "Sat" }
] as const;

const panelClass = "rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Overview ── */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-[#E7EBF0] bg-[#F7F8FB] px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#86868b]">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-[#1d1d1f]">{value || "-"}</p>
    </div>
  );
}

function OverviewPanel({ teacher }: { teacher: TeacherDetail }) {
  const classTeacher = teacher.classTeacherFor.length
    ? teacher.classTeacherFor.map((item) => `${item.name}-${item.section}`).join(", ")
    : "None";
  return (
    <section className={panelClass}>
      <h2 className="text-[15px] font-semibold text-[#031526]">Profile details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailRow label="Full name" value={teacher.fullName} />
        <DetailRow label="Status" value={teacher.status} />
        <DetailRow label="Email" value={teacher.email ?? ""} />
        <DetailRow label="Phone" value={teacher.phone} />
        <DetailRow label="Class teacher of" value={classTeacher} />
        <DetailRow label="Joined" value={formatDate(teacher.createdAt)} />
        <div className="sm:col-span-2">
          <DetailRow label="Academic background" value={teacher.academicBackground ?? ""} />
        </div>
      </div>
    </section>
  );
}

/* ── Timetable ── */

function TimetablePanel({ teacher }: { teacher: TeacherDetail }) {
  const lookup = new Map<string, { className: string; subjectName: string }>();
  for (const period of teacher.periodAssignments) {
    if (!period.classId) continue;
    lookup.set(`${period.dayOfWeek}:${period.periodNumber}`, {
      className: period.className,
      subjectName: period.subjectName
    });
  }
  const periodNumbers = Array.from({ length: teacher.timetablePeriodCount }, (_, i) => i + 1);

  return (
    <section className={panelClass}>
      <h2 className="text-[15px] font-semibold text-[#031526]">Weekly timetable</h2>
      <p className="mt-1 text-[12px] font-medium text-[#5A6573]">Empty cells are free periods.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868b]">
              <th className="px-3 py-2">Period</th>
              {weekdays.map((day) => (
                <th className="px-3 py-2" key={day.id}>{day.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodNumbers.map((periodNumber) => (
              <tr className="border-t border-[#E7EBF0]" key={periodNumber}>
                <td className="px-3 py-2.5 font-semibold text-[#1d1d1f]">P{periodNumber}</td>
                {weekdays.map((day) => {
                  const cell = lookup.get(`${day.id}:${periodNumber}`);
                  return (
                    <td className="px-3 py-2.5" key={day.id}>
                      {cell ? (
                        <div className="rounded-[6px] bg-[#EEF3FF] px-2 py-1.5">
                          <p className="font-semibold text-[#2456E6]">{cell.className}</p>
                          <p className="text-[11px] text-[#5A6573]">{cell.subjectName || "-"}</p>
                        </div>
                      ) : (
                        <span className="text-[#C2C9D4]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── Attendance ── */

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

const weekdayHeads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How each day status paints its cell and reads in the legend / detail line. */
const dayStatusStyle: Record<StaffMonthDayStatus, { cell: string; dot: string; label: string }> = {
  PRESENT: { cell: "bg-[#E1F5EA] text-[#0F8A4A]", dot: "bg-[#0F8A4A]", label: "Present" },
  ABSENT: { cell: "bg-[#FCE3E5] text-[#C8242C]", dot: "bg-[#C8242C]", label: "Absent" },
  LEAVE: { cell: "bg-[#FFF2DC] text-[#B95A00]", dot: "bg-[#B95A00]", label: "On leave" },
  HOLIDAY: { cell: "bg-[#EEF3FF] text-[#2456E6]", dot: "bg-[#2456E6]", label: "Holiday" },
  SUNDAY: { cell: "text-[#C8242C]", dot: "bg-[#C8242C]", label: "Weekly off" },
  TODAY: { cell: "text-[#2456E6]", dot: "bg-[#2456E6]", label: "Today — not punched in" },
  FUTURE: { cell: "text-[#C2C9D4]", dot: "", label: "" },
  NONE: { cell: "text-[#C2C9D4]", dot: "", label: "" }
};

const legendStatuses: StaffMonthDayStatus[] = ["PRESENT", "ABSENT", "LEAVE", "HOLIDAY"];

function dayNumber(date: string) {
  return Number(date.slice(8, 10));
}

function formatDayLabel(date: string) {
  const [year, m, d] = date.split("-").map(Number);
  return new Date(year, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function AttendancePanel({ teacher, initial, initialMonth }: { teacher: TeacherDetail; initial: StaffMonthSummary | null; initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [summary, setSummary] = useState<StaffMonthSummary | null>(initial);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(nextMonth: string) {
    setMonth(nextMonth);
    setSelectedDate(null);
    setLoading(true);
    setError("");
    try {
      setSummary(await staffAttendanceApi.userSummary(teacher.id, nextMonth));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load attendance");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  const tiles = [
    { label: "Present", value: summary?.presentDays ?? 0, accent: "text-[#0F8A4A]" },
    { label: "On leave", value: summary?.leaveDays ?? 0, accent: "text-[#B95A00]" },
    { label: "Absent", value: summary?.absentDays ?? 0, accent: "text-[#C8242C]" },
    { label: "Working days", value: summary?.workingDays ?? 0, accent: "text-[#1d1d1f]" }
  ];

  const days = summary?.days ?? [];
  const [year, m] = month.split("-").map(Number);
  const leadingBlanks = new Date(year, m - 1, 1).getDay();
  const selected = selectedDate ? days.find((day) => day.date === selectedDate) ?? null : null;

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[15px] font-semibold text-[#031526]">Monthly attendance</h2>
        <div className="flex items-center gap-2">
          <button className="h-8 w-8 rounded-[6px] border border-[#C9D3DE] bg-white text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => load(shiftMonth(month, -1))} type="button" aria-label="Previous month">‹</button>
          <span className="min-w-[128px] text-center text-[13px] font-semibold text-[#1d1d1f]">{monthLabel(month)}</span>
          <button className="h-8 w-8 rounded-[6px] border border-[#C9D3DE] bg-white text-[#2A3340] hover:bg-[#F7F8FB] disabled:opacity-40" disabled={month >= initialMonth} onClick={() => load(shiftMonth(month, 1))} type="button" aria-label="Next month">›</button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-[6px] bg-[#ff3b30]/10 p-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div className="rounded-[6px] border border-[#E7EBF0] bg-[#F7F8FB] px-4 py-3" key={tile.label}>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#86868b]">{tile.label}</p>
            <p className={`mt-1 text-[24px] font-semibold ${tile.accent} ${loading ? "opacity-40" : ""}`}>{tile.value}</p>
          </div>
        ))}
      </div>

      {/* Interactive month grid: tap a day to read its status. */}
      <div className={`mt-5 rounded-[6px] border border-[#E7EBF0] p-3 ${loading ? "opacity-40" : ""}`}>
        <div className="grid grid-cols-7 gap-1">
          {weekdayHeads.map((head, index) => (
            <div className={`py-1 text-center text-[11px] font-bold ${index === 0 ? "text-[#C8242C]" : "text-[#86868b]"}`} key={head}>{head}</div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, index) => <div key={`blank-${index}`} />)}
          {days.map((day) => {
            const style = dayStatusStyle[day.status];
            const isSelected = day.date === selectedDate;
            const selectable = day.status !== "FUTURE" && day.status !== "NONE";
            return (
              <button
                aria-label={`${formatDayLabel(day.date)}${style.label ? `: ${style.label}` : ""}`}
                aria-pressed={isSelected}
                className={`flex min-h-10 items-center justify-center rounded-[6px] text-[12px] font-semibold transition-colors ${style.cell} ${day.status === "TODAY" ? "ring-1 ring-[#2456E6]" : ""} ${isSelected ? "ring-2 ring-[#2456E6]" : ""} ${selectable ? "cursor-pointer" : "cursor-default"}`}
                disabled={!selectable}
                key={day.date}
                onClick={() => setSelectedDate(isSelected ? null : day.date)}
                type="button"
              >
                {dayNumber(day.date)}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E7EBF0] pt-3">
          {legendStatuses.map((status) => (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5A6573]" key={status}>
              <span className={`h-2.5 w-2.5 rounded-full ${dayStatusStyle[status].dot}`} />
              {dayStatusStyle[status].label}
            </span>
          ))}
        </div>
      </div>

      {selected ? (
        <p className="mt-3 text-[13px] font-medium text-[#5A6573]">
          {formatDayLabel(selected.date)}: <span className="font-semibold text-[#1d1d1f]">{dayStatusStyle[selected.status].label || "No record"}</span>
        </p>
      ) : (
        <p className="mt-3 text-[13px] font-medium text-[#5A6573]">
          Attendance rate: <span className="font-semibold text-[#1d1d1f]">{summary?.percentage == null ? "No data" : `${summary.percentage}%`}</span>
        </p>
      )}
    </section>
  );
}

/* ── Leave ── */

const leaveToneStyles: Record<LeaveRequest["status"], string> = {
  APPROVED: "bg-[#E1F5EA] text-[#0F8A4A]",
  PENDING: "bg-[#FFF2DC] text-[#B95A00]",
  REJECTED: "bg-[#FCE3E5] text-[#C8242C]",
  CANCELLED: "bg-[rgba(0,0,0,0.05)] text-[#6e6e73]"
};

function LeavePanel({ leave }: { leave: LeavePage | null }) {
  const items = leave?.items ?? [];
  return (
    <section className={panelClass}>
      <h2 className="text-[15px] font-semibold text-[#031526]">Leave history</h2>
      {items.length === 0 ? (
        <p className="mt-4 rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] px-4 py-10 text-center text-[13px] font-medium text-[#52687D]">
          No leave requests on record.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((request) => (
            <article className="rounded-[6px] border border-[#E7EBF0] bg-white px-4 py-3" key={request.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">
                    {request.type.charAt(0) + request.type.slice(1).toLowerCase()} leave · {request.days} {request.days === 1 ? "day" : "days"}
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-[#5A6573]">
                    {formatDate(request.fromDate)} – {formatDate(request.toDate)}
                  </p>
                  {request.reason ? <p className="mt-1 text-[12px] text-[#424B57]">{request.reason}</p> : null}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${leaveToneStyles[request.status]}`}>
                  {request.status.charAt(0) + request.status.slice(1).toLowerCase()}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Documents ── */

function DocumentsPanel() {
  return (
    <section className={panelClass}>
      <h2 className="text-[15px] font-semibold text-[#031526]">Documents</h2>
      <p className="mt-4 rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] px-4 py-10 text-center text-[13px] font-medium text-[#52687D]">
        No teacher documents available yet.
      </p>
    </section>
  );
}

/* ── Tab shell ── */

export function TeacherProfileTabs({
  teacher,
  initialAttendance,
  initialMonth,
  leave
}: {
  teacher: TeacherDetail;
  initialAttendance: StaffMonthSummary | null;
  initialMonth: string;
  leave: LeavePage | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-[6px] border border-[#DCE1E8] bg-white p-1.5 shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="flex min-w-max gap-1 sm:min-w-0" role="tablist" aria-label="Teacher profile sections">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                aria-selected={selected}
                className={`min-w-[106px] flex-1 rounded-[6px] px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 sm:min-w-0 ${
                  selected ? "bg-[#1d1d1f] text-white shadow-sm" : "text-[#6e6e73] hover:bg-[rgba(0,0,0,0.04)] hover:text-[#1d1d1f]"
                }`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {activeTab === "overview" ? (
          <OverviewPanel teacher={teacher} />
        ) : activeTab === "timetable" ? (
          <TimetablePanel teacher={teacher} />
        ) : activeTab === "attendance" ? (
          <AttendancePanel teacher={teacher} initial={initialAttendance} initialMonth={initialMonth} />
        ) : activeTab === "leave" ? (
          <LeavePanel leave={leave} />
        ) : (
          <DocumentsPanel />
        )}
      </div>
    </section>
  );
}
