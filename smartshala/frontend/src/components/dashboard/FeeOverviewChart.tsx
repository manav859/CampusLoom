"use client";

import { useState } from "react";

type Segment = { label: string; value: number; color: string };

export function FeeOverviewChart({ segments, title = "Fee Overview", eyebrow = "Finance", valuePrefix = "" }: { segments?: Segment[]; title?: string; eyebrow?: string; valuePrefix?: string }) {
  const data = segments ?? [];
  const [mode, setMode] = useState<"donut" | "bar">("donut");
  const [activeLabel, setActiveLabel] = useState<string | null>("Pending");

  const total = data.reduce((s, d) => s + d.value, 0);
  const activeSegment = data.find(s => s.label === activeLabel) || data.find(s => s.label === "Unmarked") || data[0] || { label: "Total", value: total, color: "#1d1d1f" };
  const cx = 50, cy = 50, r = 40, sw = 12;
  const hasData = total > 0;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = data.map((seg) => {
    const length = hasData ? (seg.value / total) * circumference : 0;
    const arc = { ...seg, length, dashOffset: -offset };
    offset += length;
    return arc;
  });

  return (
    <div className="dashboard-panel-card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">{eyebrow}</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">{title}</h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#86868b]">Live totals</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <div className="flex rounded-md border border-[#e5e5ea] bg-[#f5f5f7] p-0.5">
            <button onClick={() => setMode("donut")} className={`rounded-[4px] px-2.5 py-0.5 text-[10px] font-medium transition-colors ${mode === "donut" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b] hover:text-[#1d1d1f]"}`}>Donut</button>
            <button onClick={() => setMode("bar")} className={`rounded-[4px] px-2.5 py-0.5 text-[10px] font-medium transition-colors ${mode === "bar" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b] hover:text-[#1d1d1f]"}`}>Bar</button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {!hasData ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl bg-[#f5f5f7] px-4 text-center">
            <p className="text-[14px] font-semibold text-[#1d1d1f]">No fee data yet.</p>
            <p className="mt-1 text-[12px] font-medium text-[#86868b]">Collection, pending, and overdue totals will appear after fees are assigned.</p>
          </div>
        ) : mode === "donut" ? (
          <div className="flex h-full w-full items-center justify-center gap-5">
            <div className="relative aspect-square w-full max-w-[150px] shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f2" strokeWidth={sw} />
                {arcs.map((arc) => (
                  arc.length > 0 && (
                    <circle
                      key={arc.label}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={sw}
                      strokeDasharray={`${arc.length} ${circumference}`}
                      strokeDashoffset={arc.dashOffset}
                      transform={`rotate(-90 ${cx} ${cy})`}
                    />
                  )
                ))}
              </svg>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] font-medium text-[#86868b]">{activeSegment.label}</span>
              <span className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight" style={{ color: activeSegment.color }}>{valuePrefix}{activeSegment.value.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col justify-center gap-5 px-2">
            {data.map((seg, i) => {
              const pct = total > 0 ? Math.min(100, (seg.value / total) * 100) : 0;
              return (
                <div key={seg.label}>
                  <div className="mb-1.5 flex justify-between text-[12px] font-medium text-[#424245]">
                    <span>{seg.label}</span>
                    <span className="font-bold text-[#1d1d1f]">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#f5f5f7]">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: seg.color, transition: `width 0.8s cubic-bezier(0.25,0.1,0.25,1) ${i * 0.1}s` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        {data.map((seg) => (
          <button
            key={seg.label}
            onClick={() => setActiveLabel(seg.label)}
            type="button"
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              activeSegment.label === seg.label ? "bg-[#f5f5f7] text-[#1d1d1f]" : "text-[#424245] hover:bg-[#f5f5f7]"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </button>
        ))}
      </div>
    </div>
  );
}
