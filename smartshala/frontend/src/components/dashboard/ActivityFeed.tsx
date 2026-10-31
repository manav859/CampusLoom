"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";
import { DatePicker } from "@/components/ui/DatePicker";

const ACTIVITY_CENTER_HREF = "/activity-logs";

export type ActivityEvent = {
  actor?: string;
  detail?: string;
  id: string;
  text: string;
  time: string;
  type: "attendance" | "fee" | "alert" | "message";
};

// Each category reads at a glance from its own mark and colour, instead of the
// same anonymous dot on every row.
const typeMeta: Record<ActivityEvent["type"], { color: string; bg: string; icon: ReactNode }> = {
  attendance: {
    color: "#0071e3",
    bg: "rgba(0,113,227,0.1)",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
  },
  fee: {
    color: "#248a3d",
    bg: "rgba(52,199,89,0.12)",
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.2" />
      </>
    )
  },
  alert: {
    color: "#d70015",
    bg: "rgba(255,59,48,0.1)",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 3h.01M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0Z" />
  },
  message: {
    color: "#c2410c",
    bg: "rgba(255,149,0,0.12)",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5h8M8 14h5M21 12a8 8 0 0 1-11.5 7.2L4 20.5l1.3-4.7A8 8 0 1 1 21 12Z" />
  },
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
  const [tooltip, setTooltip] = useState<{ message: string; x: number; y: number } | null>(null);

  function showTooltip(event: MouseEvent<HTMLElement>, message: string) {
    setTooltip({ message, x: event.clientX, y: event.clientY });
  }

  return (
    <div className="dashboard-panel-card relative flex min-h-[280px] max-h-[420px] flex-col overflow-hidden p-4 sm:h-[360px] sm:p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Recent activity</h3>
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {items.length === 0 ? (
          <div className="rounded-lg px-3 py-10 text-center text-[13px] font-medium text-[#86868b]">
            Nothing happened on this day yet.
          </div>
        ) : (
          <div className="relative">
            {/* The rail that ties the markers into one timeline. It runs between
                the first and last icon centres so it never dangles past them. */}
            <span aria-hidden="true" className="pointer-events-none absolute left-[27px] top-[26px] bottom-[26px] w-px bg-[#E6E9ED]" />
            {items.map((ev) => {
              const meta = typeMeta[ev.type];
              const by = ev.actor && ev.actor !== "System" ? ev.actor : null;
              return (
                <Link
                  key={ev.id}
                  className="group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#f6f7f9]"
                  href={ACTIVITY_CENTER_HREF}
                  onMouseEnter={(event) => showTooltip(event, ev.detail || ev.text)}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(event) => showTooltip(event, ev.detail || ev.text)}
                >
                  <span
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white"
                    style={{ backgroundColor: meta.bg }}
                  >
                    <svg className="h-[18px] w-[18px]" style={{ color: meta.color }} fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                      {meta.icon}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="block truncate text-[13px] font-semibold leading-5 text-[#1d1d1f]">{ev.text}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#86868b]">
                      {by ? `${by} · ${ev.time}` : ev.time}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {tooltip ? (() => {
        const width = Math.min(360, window.innerWidth - 32);
        const height = Math.min(220, 60 + Math.ceil(tooltip.message.length / 40) * 20);
        const left = Math.min(Math.max(16, tooltip.x - width / 2), window.innerWidth - width - 16);
        const top = tooltip.y + height + 24 > window.innerHeight ? Math.max(16, tooltip.y - height - 18) : tooltip.y + 18;

        return (
          <div
            className="pointer-events-none fixed z-[230] rounded-[6px] bg-[#001827] px-3.5 py-2.5 text-[13px] font-medium leading-5 text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
            style={{ left, top, width }}
          >
            <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-[#001827]" />
            <span className="relative block whitespace-normal">{tooltip.message}</span>
          </div>
        );
      })() : null}
    </div>
  );
}
