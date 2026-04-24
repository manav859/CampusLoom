"use client";

import { useEffect, useState } from "react";

type Segment = { label: string; value: number; color: string };

const defaultSegments: Segment[] = [
  { label: "Collected", value: 65, color: "#34c759" },
  { label: "Pending", value: 25, color: "#ff9500" },
  { label: "Overdue", value: 10, color: "#ff3b30" },
];

export function FeeOverviewChart({ segments, title = "Fee overview" }: { segments?: Segment[]; title?: string }) {
  const data = segments ?? defaultSegments;
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<"donut" | "bar">("donut");
  useEffect(() => { const t = setTimeout(() => setOn(true), 200); return () => clearTimeout(t); }, []);

  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 40, cx = 50, cy = 50, sw = 12;

  // Build donut arcs
  let startAngle = -90;
  const arcs = data.map((seg) => {
    const angle = (seg.value / total) * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const sr = (startAngle * Math.PI) / 180;
    const er = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(sr);
    const y1 = cy + r * Math.sin(sr);
    const x2 = cx + r * Math.cos(er);
    const y2 = cy + r * Math.sin(er);
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    startAngle = endAngle;
    return { ...seg, path };
  });

  const primaryPct = data.length > 0 ? Math.round((data[0].value / total) * 100) : 0;

  return (
    <div className="glass-card-interactive p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Finance</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">{title}</h3>
        </div>
        <div className="flex bg-[#f5f5f7] rounded-md p-0.5 border border-[#e5e5ea]">
          <button onClick={() => setMode("donut")} className={`px-2.5 py-0.5 text-[10px] rounded-[4px] font-medium transition-colors ${mode === "donut" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b] hover:text-[#1d1d1f]"}`}>Donut</button>
          <button onClick={() => setMode("bar")} className={`px-2.5 py-0.5 text-[10px] rounded-[4px] font-medium transition-colors ${mode === "bar" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b] hover:text-[#1d1d1f]"}`}>Bar</button>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center min-h-0">
        {mode === "donut" ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="relative w-full max-w-[160px] aspect-square">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Background circle */}
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5f5f7" strokeWidth={sw} />
                {/* Arcs */}
                {arcs.map((arc) => (
                  <path
                    key={arc.label}
                    d={arc.path}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    opacity={on ? 1 : 0}
                    style={{ transition: `opacity 0.6s ease 0.3s` }}
                  />
                ))}
              </svg>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-bold text-[#1d1d1f] tracking-tight">{on ? `${primaryPct}%` : "—"}</span>
                <span className="text-[10px] font-medium text-[#86868b]">collected</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col justify-center gap-5 px-2">
            {data.map((seg, i) => (
              <div key={seg.label}>
                <div className="flex justify-between text-[12px] font-medium text-[#424245] mb-1.5">
                  <span>{seg.label}</span>
                  <span className="font-bold text-[#1d1d1f]">{Math.round((seg.value / total) * 100)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#f5f5f7] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: on ? `${(seg.value / total) * 100}%` : '0%', backgroundColor: seg.color, transition: `width 0.8s cubic-bezier(0.25,0.1,0.25,1) ${i * 0.1}s` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        {data.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1.5 text-[11px] font-medium text-[#424245]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
