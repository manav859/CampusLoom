"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { attendanceApi, type ClassesTodayReportRow } from "@/lib/api";
import { CustomSelect } from "@/components/ui/CustomSelect";

type ChartPoint = {
  absent?: number;
  attended?: number;
  label: string;
  leave?: number;
  marked?: boolean;
  present?: number;
  total?: number;
  value: number;
};

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AttendanceChart({ data, title = "Attendance Trend", classes = [] }: { data?: ChartPoint[]; title?: string; classes?: string[] }) {
  const [filter, setFilter] = useState("All");
  const [on, setOn] = useState(false);
  const [tooltip, setTooltip] = useState<{ point: ChartPoint; x: number; y: number } | null>(null);
  const [pastWeekOpen, setPastWeekOpen] = useState(false);
  const [pastWeekDays, setPastWeekDays] = useState<PastWeekDay[]>([]);
  const [pastWeekLoading, setPastWeekLoading] = useState(false);
  const [pastWeekError, setPastWeekError] = useState("");
  
  useEffect(() => { const t = setTimeout(() => setOn(true), 100); return () => clearTimeout(t); }, []);

  const allData = data ?? [];
  const d = (filter === "All" ? allData : allData.filter((point) => point.label === filter)).filter((point) => point.marked !== false);
  const selectedClassExists = filter !== "All" && classes.includes(filter);
  const classOptions = [
    { label: "All Classes", value: "All" },
    ...classes.map((className) => ({ label: className, value: className }))
  ];

  const attendanceControls = (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <CustomSelect
        ariaLabel="Filter attendance class"
        className="h-8 max-w-[160px] text-[11px] text-[#2456E6]"
        menuClassName="left-0 right-auto sm:left-auto sm:right-0"
        onChange={setFilter}
        options={classOptions}
        value={filter}
      />
      <button onClick={openPastWeek} className="h-8 rounded-[6px] bg-[#2456E6]/10 px-3 text-[11px] font-bold text-[#2456E6] transition-colors hover:bg-[#2456E6]/20" type="button">Past Week Attendance</button>
    </div>
  );

  async function openPastWeek() {
    setPastWeekOpen(true);
    setPastWeekLoading(true);
    setPastWeekError("");
    try {
      // One request per day (today → 6 days ago) so each class shows its own
      // numbers for each day, instead of a single whole-week total per class.
      const dates = Array.from({ length: 7 }, (_, index) => isoDate(-index));
      const days = await Promise.all(
        dates.map(async (date) => ({ date, rows: await attendanceApi.classesTodayReport({ dateFrom: date, dateTo: date }) }))
      );
      setPastWeekDays(days);
    } catch (err) {
      setPastWeekError(err instanceof Error ? err.message : "Unable to load past week attendance");
    } finally {
      setPastWeekLoading(false);
    }
  }

  if (d.length === 0) {
    return (
      <div className="dashboard-panel-card p-4 sm:p-5 h-full flex flex-col">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Overview</p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">{title}</h3>
          </div>
          {attendanceControls}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[14px] font-semibold text-[#1d1d1f]">
            {selectedClassExists ? `No attendance submitted for ${filter} today yet.` : "No attendance has been submitted today yet."}
          </p>
          <p className="mt-1 text-[12px] font-medium text-[#86868b]">Past records are available from the weekly view.</p>
        </div>
        <PastWeekModal
          days={pastWeekDays}
          error={pastWeekError}
          loading={pastWeekLoading}
          onClose={() => setPastWeekOpen(false)}
          open={pastWeekOpen}
        />
      </div>
    );
  }

  function attendanceValue(point: ChartPoint) {
    if (typeof point.attended === "number" && typeof point.total === "number" && point.total > 0) {
      return Math.round((point.attended / point.total) * 100);
    }
    return point.value;
  }

  function barColor(value: number) {
    if (value >= 90) return "bg-[#0F8A4A]";
    if (value >= 75) return "bg-[#F6C343]";
    if (value >= 60) return "bg-[#B95A00]";
    return "bg-[#C8242C]";
  }

  function showTooltip(event: MouseEvent<HTMLElement>, point: ChartPoint) {
    setTooltip({ point, x: event.clientX, y: event.clientY });
  }

  const plotted = d.map((point) => ({ ...point, value: attendanceValue(point) }));
  const gridLines = [
    { value: 100, className: "border-[#E8EBF2]" },
    { value: 75, className: "border-[#FF3B30]" },
    { value: 50, className: "border-[#E8EBF2]" },
    { value: 25, className: "border-[#E8EBF2]" }
  ];

  return (
    <div className="dashboard-panel-card p-4 sm:p-5 h-full flex flex-col relative">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Overview</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">{title}</h3>
        </div>
        {attendanceControls}
      </div>
      <div className="relative flex-1 min-h-[190px] overflow-x-auto px-1">
        <div className="absolute inset-x-1 top-3 bottom-7 pointer-events-none">
          {gridLines.map((line) => (
            <div
              className={`absolute left-0 right-0 border-t border-dashed ${line.className}`}
              key={line.value}
              style={{ top: `${100 - line.value}%` }}
            />
          ))}
        </div>
        <div
          className="relative z-10 grid h-full min-w-full gap-6"
          style={{ gridTemplateColumns: `repeat(${plotted.length}, minmax(56px, 1fr))` }}
        >
          {plotted.map((point, index) => {
            const height = on ? Math.max(6, Math.min(100, point.value)) : 0;
            return (
              <div className="flex min-h-[190px] flex-col items-center justify-end" key={point.label}>
                <button
                  aria-label={`${point.label} attendance ${point.value}%`}
                  className="flex h-[150px] w-full items-end justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2456E6]/40 focus:ring-offset-2"
                  onBlur={() => setTooltip(null)}
                  onFocus={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setTooltip({ point, x: rect.left + rect.width / 2, y: rect.top + 24 });
                  }}
                  onMouseEnter={(event) => showTooltip(event, point)}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(event) => showTooltip(event, point)}
                  type="button"
                >
                  <span
                    className={`block w-9 rounded-t-lg rounded-b-[3px] shadow-[0_8px_18px_-10px_rgba(15,20,25,0.45)] transition-all duration-700 ease-apple ${barColor(point.value)}`}
                    style={{ height: `${height}%`, transitionDelay: `${index * 60}ms` }}
                  />
                </button>
                <span className={`mt-3 block w-full text-center text-[11px] font-semibold transition-colors duration-200 ${tooltip?.point.label === point.label ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltip ? (() => {
        const width = 180;
        const height = 86;
        const left = Math.min(Math.max(16, tooltip.x + 18), window.innerWidth - width - 16);
        const top = tooltip.y + height + 24 > window.innerHeight ? Math.max(16, tooltip.y - height - 18) : tooltip.y + 18;
        const point = tooltip.point;

        return (
          <div
            className="pointer-events-none fixed z-[230] rounded-[10px] border border-white/10 bg-[#1d1d1f]/90 px-3 py-2 text-[12px] font-medium text-white shadow-xl backdrop-blur-md"
            style={{ left, top, width }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[#a1a1a6]">{point.label}</span>
              <span className="font-bold text-white">{point.value}%</span>
            </div>
            {typeof point.present === "number" || typeof point.leave === "number" ? (
              <p className="mt-1 text-[11px] text-white/70">
                Present {point.present ?? 0}, on leave {point.leave ?? 0}
              </p>
            ) : null}
          </div>
        );
      })() : null}
      <PastWeekModal
        days={pastWeekDays}
        error={pastWeekError}
        loading={pastWeekLoading}
        onClose={() => setPastWeekOpen(false)}
        open={pastWeekOpen}
      />
    </div>
  );
}

type PastWeekDay = { date: string; rows: ClassesTodayReportRow[] };

/** "2026-10-30" → "Thu, 30 Oct". Parsed as a local date so it never shifts a day. */
function formatDayLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const dayMonth = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${weekday}, ${dayMonth}`;
}

function relativeDayLabel(iso: string) {
  if (iso === isoDate()) return "Today";
  if (iso === isoDate(-1)) return "Yesterday";
  return null;
}

function percentageBarColor(value: number) {
  if (value >= 90) return "bg-[#0F8A4A]";
  if (value >= 75) return "bg-[#F6C343]";
  if (value >= 60) return "bg-[#B95A00]";
  return "bg-[#C8242C]";
}

function percentageTextColor(value: number) {
  if (value >= 90) return "text-[#0F8A4A]";
  if (value >= 75) return "text-[#B98900]";
  if (value >= 60) return "text-[#B95A00]";
  return "text-[#C8242C]";
}

function PastWeekModal({
  days,
  error,
  loading,
  onClose,
  open
}: {
  days: PastWeekDay[];
  error: string;
  loading: boolean;
  onClose: () => void;
  open: boolean;
}) {
  if (!open) return null;

  const anyMarked = days.some((day) => day.rows.some((row) => row.marked));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button aria-label="Close past week attendance" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e5ea] px-6 py-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[#1d1d1f]">Past Week Attendance</h2>
            <p className="mt-1 text-[13px] font-medium text-[#86868b]">Per class, day by day · {isoDate(-6)} to {isoDate()}</p>
          </div>
          <button className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-bold text-[#424245] hover:bg-[#e8e8ed]" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-6 py-5">
          {loading ? (
            <p className="text-[13px] font-medium text-[#86868b]">Loading weekly attendance...</p>
          ) : error ? (
            <p className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-semibold text-[#d70015]">{error}</p>
          ) : !anyMarked ? (
            <p className="rounded-xl bg-[#f5f5f7] px-4 py-5 text-center text-[13px] font-semibold text-[#5A6573]">No attendance was submitted in the past week.</p>
          ) : (
            <div className="space-y-6">
              {days.map((day) => {
                const marked = day.rows.filter((row) => row.marked);
                const attended = marked.reduce((sum, row) => sum + row.attended, 0);
                const total = marked.reduce((sum, row) => sum + row.total, 0);
                const average = total ? Math.round((attended / total) * 1000) / 10 : 0;
                const relative = relativeDayLabel(day.date);

                return (
                  <section key={day.date}>
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-[#1d1d1f]">{formatDayLabel(day.date)}</h3>
                        {relative ? (
                          <span className="rounded-full bg-[#2456E6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#2456E6]">{relative}</span>
                        ) : null}
                      </div>
                      {marked.length ? (
                        <span className="text-[12px] font-semibold text-[#86868b]">
                          {marked.length} {marked.length === 1 ? "class" : "classes"} · <span className={percentageTextColor(average)}>{average}% avg</span>
                        </span>
                      ) : null}
                    </div>
                    {marked.length === 0 ? (
                      <p className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-[12px] font-medium text-[#86868b]">No attendance submitted.</p>
                    ) : (
                      <div className="space-y-2">
                        {marked.map((row) => (
                          <div key={row.classId} className="rounded-xl border border-[#E5E8EF] px-4 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[13px] font-semibold text-[#1d1d1f]">{row.className}</p>
                              <span className={`text-[14px] font-bold ${percentageTextColor(row.percentage)}`}>{row.percentage}%</span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1f6]">
                              <div className={`h-full rounded-full ${percentageBarColor(row.percentage)}`} style={{ width: `${Math.min(100, row.percentage)}%` }} />
                            </div>
                            <p className="mt-1.5 text-[11px] font-medium text-[#86868b]">Present {row.present} · Absent {row.absent} · Leave {row.leave}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
