"use client";

import { useState, type MouseEvent } from "react";
import { DatePicker } from "@/components/ui/DatePicker";

export type ActivityEvent = {
  details?: string[];
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
  const [tooltip, setTooltip] = useState<{ event: ActivityEvent; x: number; y: number } | null>(null);

  function showTooltip(event: MouseEvent<HTMLElement>, item: ActivityEvent) {
    setTooltip({ event: item, x: event.clientX, y: event.clientY });
  }

  return (
    <div className="dashboard-panel-card relative flex h-[360px] flex-col p-4 sm:p-5">
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Activity</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">Recent Events</h3>
        </div>
        {selectedDate && onDateChange ? (
          <DatePicker
            buttonClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DCE1E8] bg-white p-0 text-[#2456E6] transition hover:bg-[#F2F7FC] [&>span]:hidden"
            max={maxDate}
            onChange={onDateChange}
            value={selectedDate}
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {items.length === 0 ? (
          <div className="rounded-lg px-3 py-8 text-center text-[13px] font-medium text-[#86868b]">
            No activity found for this date.
          </div>
        ) : (
          items.map((ev) => {
            const style = typeIcon[ev.type];
            return (
              <div
                key={ev.id}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f5f5f7]"
                onMouseEnter={(event) => showTooltip(event, ev)}
                onMouseLeave={() => setTooltip(null)}
                onMouseMove={(event) => showTooltip(event, ev)}
              >
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: style.bg }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-[13px] font-semibold leading-5 text-[#1d1d1f]">{ev.text}</p>
                  <p className="mt-0.5 text-[11px] text-[#86868b]">{ev.time}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {tooltip ? (() => {
        const width = Math.min(420, window.innerWidth - 32);
        const height = Math.min(260, 74 + (tooltip.event.details?.length ?? 0) * 22);
        const left = Math.min(Math.max(16, tooltip.x - width / 2), window.innerWidth - width - 16);
        const top = tooltip.y + height + 24 > window.innerHeight ? Math.max(16, tooltip.y - height - 18) : tooltip.y + 18;

        return (
          <div
            className="pointer-events-none fixed z-[230] max-h-[260px] overflow-y-auto rounded-[5px] bg-[#001827] px-4 py-3 text-[14px] font-semibold leading-6 text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
            style={{ left, top, width }}
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#001827]" />
            <span className="relative block whitespace-normal">
              <span className="mb-1 block">{tooltip.event.text}</span>
              {tooltip.event.details?.map((line) => <span className="block" key={line}>- {line}</span>)}
            </span>
          </div>
        );
      })() : null}
    </div>
  );
}
