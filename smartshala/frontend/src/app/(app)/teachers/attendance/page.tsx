"use client";

import { useCallback, useEffect, useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { SideModal } from "@/components/ui/SideModal";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { staffAttendanceApi, type StaffDay, type StaffDayStatus, type StaffMonthSummary } from "@/lib/api";
import { humanizeConstant } from "@/lib/formatters";

type Row = StaffDay["staff"][number];

/** The device's calendar day, not UTC's — the server reads the date the same way. */
function dayValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDay(value: string, delta: number) {
  const [year, month, day] = value.split("-").map(Number);
  return dayValue(new Date(year, month - 1, day + delta));
}

function dayLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** "6h 25m", as the teacher's own punch card shows it. */
function hours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** The same, but a break under an hour reads as plain minutes. */
function span(minutes: number) {
  return minutes < 60 ? `${minutes}m` : hours(minutes);
}

/** YYYY-MM for the month the given day falls in. */
function monthValue(value: string) {
  return value.slice(0, 7);
}

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

const statusView: Record<StaffDayStatus, { label: string; tone: "good" | "warn" | "danger" }> = {
  PRESENT: { label: "Present", tone: "good" },
  ON_LEAVE: { label: "On Leave", tone: "warn" },
  NOT_PUNCHED_IN: { label: "Not In", tone: "danger" }
};

const tabs: Array<{ label: string; status: StaffDayStatus | null }> = [
  { label: "All", status: null },
  { label: "Not In", status: "NOT_PUNCHED_IN" },
  { label: "On Leave", status: "ON_LEAVE" },
  { label: "Present", status: "PRESENT" }
];

export default function TeacherAttendancePage() {
  const [today] = useState(() => dayValue(new Date()));
  const [date, setDate] = useState(today);
  const [data, setData] = useState<StaffDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StaffDayStatus | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [selfie, setSelfie] = useState<{ name: string; url: string; revoke: boolean } | null>(null);
  const [breaks, setBreaks] = useState<Row | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError("");
    try {
      setData(await staffAttendanceApi.day(target));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load teacher attendance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [load, date]);

  const rows = data ? (filter ? data.staff.filter((row) => row.status === filter) : data.staff) : [];
  const counts: Record<string, number> = {
    All: data?.total ?? 0,
    "Not In": data?.notPunchedIn ?? 0,
    "On Leave": data?.onLeave ?? 0,
    Present: data?.present ?? 0
  };
  const closedNote = data?.holiday ? `School holiday: ${data.holiday}` : data?.isSunday ? "Sunday — the school is closed." : null;
  const tiles = [
    { label: "Present", value: data?.present ?? 0, bg: "bg-[#EAF9EB]" },
    { label: "On Leave", value: data?.onLeave ?? 0, bg: "bg-[#E5F7FF]" },
    { label: "Not In", value: data?.notPunchedIn ?? 0, bg: "bg-[#FFF0E8]" }
  ];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Teacher Attendance"
        breadcrumbs={[{ label: "Teacher Management", href: "/teachers" }, { label: "Teacher Attendance" }]}
        action={
          <div className="flex items-center gap-2">
            <button aria-label="Previous day" className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => setDate((current) => shiftDay(current, -1))} type="button">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="w-[190px]">
              <DatePicker max={today} onChange={(value) => value && setDate(value)} value={date} />
            </div>
            <button aria-label="Next day" className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white text-[#2A3340] hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-40" disabled={date >= today} onClick={() => setDate((current) => shiftDay(current, 1))} type="button">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        }
      />

      <p className="-mt-2 text-[13px] text-[#5A6573]">
        {date === today ? `Today · ${dayLabel(date)}` : dayLabel(date)} — who has punched in with Swipe To Punch, who is on approved leave, and who is neither.
        Open a teacher for their month.
      </p>

      {error ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}
      {closedNote && !loading ? <div className="rounded-[8px] bg-[#FFF2DC] px-4 py-3 text-[13px] font-semibold text-[#B95A00]">{closedNote}</div> : null}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {tiles.map((tile) => (
          <div className={`rounded-[8px] px-4 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:px-5 ${tile.bg}`} key={tile.label}>
            <p className="truncate text-[13px] font-medium text-[#6F7480] sm:text-[14px]">{tile.label}</p>
            <p className="mt-1.5 truncate text-[22px] font-bold text-[#111827] [font-variant-numeric:tabular-nums] sm:text-[26px]">{loading ? "—" : tile.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map((tab) => {
          const active = filter === tab.status;
          return (
            <button
              aria-selected={active}
              className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition ${active ? "bg-[#2456E6] text-white" : "border border-[#DCE1E8] bg-white text-[#2A3340] hover:bg-[#F7F8FB]"}`}
              key={tab.label}
              onClick={() => setFilter(tab.status)}
              role="tab"
              type="button"
            >
              {tab.label}
              {!loading && counts[tab.label] > 0 ? (
                <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-[#EEF1F5] text-[#5A6573]"}`}>{counts[tab.label]}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-14" key={index} />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">No teachers here.</p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-[#DCE1E8] bg-[#F7F8FB] text-[12px] font-semibold uppercase tracking-wide text-[#5A6573]">
                  <tr>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Punch in</th>
                    <th className="px-4 py-3">Punch out</th>
                    <th className="px-4 py-3">Breaks</th>
                    <th className="px-4 py-3">Selfie</th>
                    <th className="px-4 py-3 text-right">Worked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF1F5]">
                  {rows.map((row) => (
                    <tr className="cursor-pointer hover:bg-[#FAFBFC]" key={row.id} onClick={() => setSelected(row)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#2456E6]">{row.fullName}</p>
                        <p className="text-[12px] text-[#5A6573]">{row.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill label={statusView[row.status].label} tone={statusView[row.status].tone} />
                          {row.leaveType ? <span className="text-[12px] text-[#5A6573]">{leaveLabel(row.leaveType)}</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 [font-variant-numeric:tabular-nums]">{row.punchInAt ? time(row.punchInAt) : "—"}</td>
                      <td className="px-4 py-3 [font-variant-numeric:tabular-nums]">{row.punchOutAt ? time(row.punchOutAt) : row.punchInAt ? <span className="text-[#86868b]">{row.onBreak ? "On break" : "Not punched out"}</span> : "—"}</td>
                      <td className="px-4 py-3">
                        <BreaksCell onOpen={setBreaks} row={row} />
                      </td>
                      <td className="px-4 py-3">
                        <SelfieCell date={date} onOpen={setSelfie} row={row} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#0F1419] [font-variant-numeric:tabular-nums]">{row.workedMinutes != null ? hours(row.workedMinutes) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: cards */}
            <div className="divide-y divide-[#EEF1F5] md:hidden">
              {rows.map((row) => (
                <div className="px-4 py-3" key={row.id}>
                  <div className="flex w-full items-center justify-between gap-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(row)} type="button">
                      <span className="block truncate text-[14px] font-semibold text-[#2456E6]">{row.fullName}</span>
                      <span className="block text-[12px] text-[#5A6573]">{detail(row)}</span>
                    </button>
                    <StatusPill label={statusView[row.status].label} tone={statusView[row.status].tone} />
                  </div>
                  {row.punchInAt ? (
                    <div className="mt-2 flex items-center gap-2">
                      <SelfieCell date={date} onOpen={setSelfie} row={row} />
                      {row.breaks.length > 0 ? <BreaksCell onOpen={setBreaks} row={row} /> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {selected ? <TeacherMonthPanel key={selected.id} onClose={() => setSelected(null)} startMonth={monthValue(date)} teacher={selected} /> : null}
      {breaks ? <BreaksPanel date={date} onClose={() => setBreaks(null)} teacher={breaks} /> : null}
      {selfie ? <SelfieViewer onClose={() => setSelfie(null)} selfie={selfie} /> : null}
    </div>
  );
}

/**
 * One teacher's month of working days — the same four tiles the principal app
 * shows on a Teacher Profile. Working days run from the month start (or the day
 * they joined) to today, minus Sundays and school holidays.
 */
/** The punch selfie for one teacher on the day being viewed. The image is
 * fetched only when the principal asks for it, so opening the day costs no
 * signed URLs. The row behind this cell opens the month panel, hence the
 * stopPropagation. */
function SelfieCell({
  date,
  onOpen,
  row
}: {
  date: string;
  onOpen: (selfie: { name: string; url: string; revoke: boolean }) => void;
  row: Row;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!row.hasSelfie) {
    return <span className="text-[#86868b]">{row.punchInAt ? "No selfie" : "—"}</span>;
  }

  return (
    <button
      className="rounded-full border border-[#D8DEE7] px-3 py-1 text-[12px] font-semibold text-[#2456E6] hover:bg-[#F2F6FF] disabled:opacity-60"
      disabled={loading}
      onClick={(event) => {
        event.stopPropagation();
        setLoading(true);
        setError("");
        staffAttendanceApi
          .punchSelfie(row.id, date)
          .then((result) => onOpen({ name: row.fullName, url: result.url, revoke: result.revoke }))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not open it"))
          .finally(() => setLoading(false));
      }}
      title={error || undefined}
      type="button"
    >
      {loading ? "Opening…" : error ? "Try again" : "View"}
    </button>
  );
}

/** The day's breaks for one teacher, already on the row — opening the list
 * costs no request. The row behind this cell opens the month panel, hence the
 * stopPropagation. */
function BreaksCell({ onOpen, row }: { onOpen: (row: Row) => void; row: Row }) {
  if (row.breaks.length === 0) {
    return <span className="text-[#86868b]">{row.punchInAt ? "No breaks" : "—"}</span>;
  }

  return (
    <button
      className="rounded-full border border-[#D8DEE7] px-3 py-1 text-[12px] font-semibold text-[#2456E6] hover:bg-[#F2F6FF]"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(row);
      }}
      type="button"
    >
      {row.breaks.length} · {span(row.breakMinutes)}
    </button>
  );
}

function BreaksPanel({ date, onClose, teacher }: { date: string; onClose: () => void; teacher: Row }) {
  return (
    <SideModal eyebrow={dayLabel(date)} onClose={onClose} title={`${teacher.fullName} — Breaks`}>
      <div className="rounded-[8px] bg-[#FFF2DC] px-4 py-4">
        <p className="text-[13px] font-medium text-[#6F7480]">Total break time</p>
        <p className="mt-1.5 text-[22px] font-bold text-[#111827] [font-variant-numeric:tabular-nums]">{span(teacher.breakMinutes)}</p>
      </div>

      <ol className="mt-4 divide-y divide-[#EEF1F5] rounded-[8px] border border-[#DCE1E8]">
        {teacher.breaks.map((item, index) => (
          <li className="flex items-center justify-between gap-4 px-4 py-3" key={item.startAt}>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0F1419] [font-variant-numeric:tabular-nums]">
                {time(item.startAt)} → {item.endAt ? time(item.endAt) : "on break"}
              </p>
              <p className="text-[12px] text-[#5A6573]">Break {index + 1}</p>
            </div>
            <p className="shrink-0 text-[13px] font-semibold text-[#0F1419] [font-variant-numeric:tabular-nums]">
              {span(item.minutes)}
              {item.endAt ? "" : " so far"}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[12px] text-[#86868b]">
        A break is the gap between punching out for one and punching back in. Breaks do not count as worked time.
      </p>
    </SideModal>
  );
}

function SelfieViewer({
  onClose,
  selfie
}: {
  onClose: () => void;
  selfie: { name: string; url: string; revoke: boolean };
}) {
  // An object URL pins the image bytes in memory until it is released.
  useEffect(() => {
    if (!selfie.revoke) return;
    return () => URL.revokeObjectURL(selfie.url);
  }, [selfie]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div className="max-w-sm rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-6">
          <p className="font-semibold text-[#0F1419]">{selfie.name}</p>
          <button className="text-[13px] font-semibold text-[#5A6573]" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived storage URL, not a static asset */}
        <img alt={`Punch selfie for ${selfie.name}`} className="w-full rounded-xl" src={selfie.url} />
      </div>
    </div>
  );
}

function TeacherMonthPanel({ onClose, startMonth, teacher }: { onClose: () => void; startMonth: string; teacher: Row }) {
  const [thisMonth] = useState(() => monthValue(dayValue(new Date())));
  const [month, setMonth] = useState(startMonth);
  const [summary, setSummary] = useState<StaffMonthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    staffAttendanceApi
      .userSummary(teacher.id, month)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load this month");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, teacher.id]);

  const tiles = [
    { label: "Present", value: summary?.presentDays, bg: "bg-[#EAF9EB]" },
    { label: "Absent", value: summary?.absentDays, bg: "bg-[#FFF0E8]" },
    { label: "Leave", value: summary?.leaveDays, bg: "bg-[#E5F7FF]" },
    { label: "Attendance", value: summary?.percentage == null ? "—" : `${summary.percentage}%`, bg: "bg-[#E2EAFD]" }
  ];

  return (
    <SideModal eyebrow={teacher.phone} onClose={onClose} title={teacher.fullName}>
      <div className="flex items-center justify-between gap-2">
        <button aria-label="Previous month" className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => setMonth((current) => shiftMonth(current, -1))} type="button">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p className="text-[14px] font-semibold text-[#0F1419]">{monthLabel(month)}</p>
        <button aria-label="Next month" className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white text-[#2A3340] hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-40" disabled={month >= thisMonth} onClick={() => setMonth((current) => shiftMonth(current, 1))} type="button">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {error ? <div className="mt-4 rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div className={`rounded-[8px] px-4 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] ${tile.bg}`} key={tile.label}>
            <p className="truncate text-[13px] font-medium text-[#6F7480]">{tile.label}</p>
            <p className="mt-1.5 truncate text-[22px] font-bold text-[#111827] [font-variant-numeric:tabular-nums]">
              {loading || summary == null ? "—" : tile.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12px] text-[#86868b]">
        {loading || summary == null
          ? "Loading this month…"
          : `${summary.workingDays} ${summary.workingDays === 1 ? "working day" : "working days"} so far — Sundays and school holidays are not counted. Today only counts once it is present or leave.`}
      </p>
    </SideModal>
  );
}

/** "Casual Leave", "Sick Leave" … "Other", as the apps label them. */
function leaveLabel(type: string) {
  return type === "OTHER" ? "Other" : `${humanizeConstant(type)} Leave`;
}

/** The phone card's second line — the same text the principal app shows. */
function detail(row: Row) {
  if (row.status === "NOT_PUNCHED_IN") return row.phone;
  if (row.status === "ON_LEAVE") return row.leaveType ? leaveLabel(row.leaveType) : "On leave";
  return [
    `In ${time(row.punchInAt!)}`,
    row.punchOutAt ? `Out ${time(row.punchOutAt)}` : "not punched out",
    row.workedMinutes != null ? hours(row.workedMinutes) : null
  ].filter(Boolean).join(" · ");
}
