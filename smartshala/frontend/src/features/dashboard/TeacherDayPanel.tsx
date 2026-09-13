"use client";

import { useEffect, useState } from "react";
import { teacherDayApi, type MySchedulePeriod, type PunchStatus } from "@/lib/api";

function minutesOf(time: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return Number.isNaN(hours) || Number.isNaN(minutes) ? null : hours * 60 + minutes;
}

/**
 * "Now" is the period in progress and "Upcoming" the single next one to start;
 * untimed periods get neither. Mirrors scheduleBadges() in the teacher app so
 * both surfaces badge the same period.
 */
function scheduleBadges(periods: MySchedulePeriod[], now: Date) {
  const minute = now.getHours() * 60 + now.getMinutes();
  let upcomingGiven = false;
  return periods.map((period) => {
    const start = minutesOf(period.startTime);
    const end = minutesOf(period.endTime);
    if (start === null || end === null) return null;
    if (start <= minute && minute < end) return "Now" as const;
    if (!upcomingGiven && start > minute) {
      upcomingGiven = true;
      return "Upcoming" as const;
    }
    return null;
  });
}

function clockTime(value: string | null) {
  return value ? new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—";
}

function workedLabel(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const punchCopy = {
  NOT_PUNCHED_IN: { label: "Not punched in", tone: "bg-[#FFF0E8] text-[#B95A00]" },
  PUNCHED_IN: { label: "Punched in", tone: "bg-[#E1F5EA] text-[#0F8A4A]" },
  PUNCHED_OUT: { label: "Day complete", tone: "bg-[#E2F0FB] text-[#1F6FB8]" }
};

/** Today's punch and timetable — the same data the teacher app shows on Home. */
export function TeacherDayPanel() {
  const [punch, setPunch] = useState<PunchStatus | null>(null);
  const [periods, setPeriods] = useState<MySchedulePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([teacherDayApi.punchStatus(), teacherDayApi.schedule()]).then(([punchResult, scheduleResult]) => {
      if (!active) return;
      if (punchResult.status === "fulfilled") setPunch(punchResult.value);
      if (scheduleResult.status === "fulfilled") setPeriods(scheduleResult.value.periods);
      setLoading(false);
    });
    // Now / Upcoming move with the clock.
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const badges = scheduleBadges(periods, new Date());
  const copy = punchCopy[punch?.state ?? "NOT_PUNCHED_IN"];

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-[1fr_2fr]">
      <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#0F1419]">Today&apos;s Punch</h2>
          {loading ? null : <span className={`rounded-[6px] px-2 py-1 text-[12px] font-semibold ${copy.tone}`}>{copy.label}</span>}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Punch in", value: clockTime(punch?.punchInAt ?? null) },
            { label: "Punch out", value: clockTime(punch?.punchOutAt ?? null) },
            { label: "Worked", value: punch && punch.state !== "NOT_PUNCHED_IN" ? workedLabel(punch.workedMinutes) : "—" }
          ].map((item) => (
            <div className="rounded-[8px] bg-[#F7F8FB] px-2 py-3" key={item.label}>
              <dt className="text-[12px] text-[#5A6573]">{item.label}</dt>
              <dd className="mt-1 text-[15px] font-bold text-[#0F1419] [font-variant-numeric:tabular-nums]">{loading ? "…" : item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12px] text-[#86868b]">Punch in and out with Swipe To Punch in the SmartShala Teacher app.</p>
      </div>

      <div className="min-w-0 rounded-[8px] border border-[#DCE1E8] bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#0F1419]">Today&apos;s Schedule</h2>
          {periods.length ? <span className="text-[12px] font-semibold text-[#5A6573]">{periods.length} periods</span> : null}
        </div>
        {loading ? (
          <div className="mt-4 h-24 animate-pulse rounded-[8px] bg-[#F2F5F8]" />
        ) : periods.length === 0 ? (
          <p className="mt-4 rounded-[8px] bg-[#F7F8FB] px-4 py-6 text-center text-[13px] text-[#5A6573]">You have no periods assigned for today.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {periods.map((period, index) => (
              <li className="flex items-center gap-3 rounded-[8px] border border-[#EEF1F5] px-3 py-2.5" key={`${period.periodNumber}-${index}`}>
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[8px] bg-[#E2EAFD] text-[#2456E6]">
                  <span className="text-[9px] font-bold leading-none">P</span>
                  <span className="text-[15px] font-bold leading-tight">{period.periodNumber}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#0F1419]">Class {period.className}</span>
                  <span className="block truncate text-[12px] text-[#5A6573]">
                    {period.subjectName}
                    {period.startTime && period.endTime ? ` · ${period.startTime} – ${period.endTime}` : ""}
                  </span>
                </span>
                {badges[index] === "Now" ? <span className="rounded-[6px] bg-[#E1F5EA] px-2 py-1 text-[11px] font-semibold text-[#0F8A4A]">Now</span> : null}
                {badges[index] === "Upcoming" ? <span className="rounded-[6px] bg-[#E2EAFD] px-2 py-1 text-[11px] font-semibold text-[#2456E6]">Upcoming</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
