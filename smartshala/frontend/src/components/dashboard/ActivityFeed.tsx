"use client";

import Link from "next/link";
import { DatePicker } from "@/components/ui/DatePicker";

const ACTIVITY_CENTER_HREF = "/activity-logs";

export type ActivityEvent = {
  actor?: string;
  id: string;
  text: string;
  time: string;
  type: "attendance" | "fee" | "alert" | "message";
};

const typeIcon: Record<ActivityEvent["type"], { color: string; bg: string }> = {
  attendance: { color: "#0071e3", bg: "rgba(0,113,227,0.08)" },
  fee: { color: "#34c759", bg: "rgba(52,199,89,0.08)" },
  alert: { color: "#ff3b30", bg: "rgba(255,59,48,0.08)" },
  message: { color: "#ff9500", bg: "rgba(255,149,0,0.08)" },
};

export function ActivityFeed({
  events,
  maxDate,
  onDateChange,
  selectedDate
}: {
  events?: ActivityEvent[];
  maxDate?: string;
  onDateChange?: (date: string) => void;
  selectedDate?: string;
}) {
  const items = events ?? [];

  return (
    <div className="dashboard-panel-card relative flex min-h-[280px] max-h-[420px] flex-col overflow-hidden p-4 sm:h-[360px] sm:p-5">
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Activity</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">Recent Events</h3>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#2456E6] transition hover:bg-[#F2F7FC] sm:inline-flex"
            href={ACTIVITY_CENTER_HREF}
          >
            View all
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {selectedDate && onDateChange ? (
            <DatePicker
              buttonClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DCE1E8] bg-white p-0 text-[#2456E6] transition hover:bg-[#F2F7FC] [&>span]:hidden"
              max={maxDate}
              onChange={onDateChange}
              value={selectedDate}
            />
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
        {items.length === 0 ? (
          <div className="rounded-lg px-3 py-8 text-center text-[13px] font-medium text-[#86868b]">
            No activity found for this date.
          </div>
        ) : (
          items.map((ev) => {
            const style = typeIcon[ev.type];
            const by = ev.actor && ev.actor !== "System" ? ev.actor : null;
            return (
              <Link
                key={ev.id}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#f5f5f7]"
                href={ACTIVITY_CENTER_HREF}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: style.bg }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.color }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-5 text-[#1d1d1f]">{ev.text}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#86868b]">
                    {by ? `${by} · ${ev.time}` : ev.time}
                  </span>
                </span>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[#c7c7cc] transition group-hover:translate-x-0.5 group-hover:text-[#86868b]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
