"use client";

import { useEffect, useState } from "react";
import { attendanceApi, type ClassesTodayReportRow } from "@/lib/api";

type ChartPoint = { label: string; value: number; marked?: boolean };

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AttendanceChart({ data, title = "Attendance trend", classes = [] }: { data?: ChartPoint[]; title?: string; classes?: string[] }) {
  const [filter, setFilter] = useState("All");
  const [on, setOn] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number, y: number, label: string, value: number } | null>(null);
  const [pastWeekOpen, setPastWeekOpen] = useState(false);
  const [pastWeekRows, setPastWeekRows] = useState<ClassesTodayReportRow[]>([]);
  const [pastWeekLoading, setPastWeekLoading] = useState(false);
  const [pastWeekError, setPastWeekError] = useState("");
  
  useEffect(() => { const t = setTimeout(() => setOn(true), 100); return () => clearTimeout(t); }, []);

  const allData = data ?? [];
  const d = (filter === "All" ? allData : allData.filter((point) => point.label === filter)).filter((point) => point.marked !== false);
  const selectedClassExists = filter !== "All" && classes.includes(filter);

  async function openPastWeek() {
    setPastWeekOpen(true);
    setPastWeekLoading(true);
    setPastWeekError("");
    try {
      const rows = await attendanceApi.classesTodayReport({ dateFrom: isoDate(-6), dateTo: isoDate() });
      setPastWeekRows(rows);
    } catch (err) {
      setPastWeekError(err instanceof Error ? err.message : "Unable to load past week attendance");
    } finally {
      setPastWeekLoading(false);
    }
  }

  if (d.length === 0) {
    return (
      <div className="glass-card-interactive p-5 h-full flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Overview</p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">{title}</h3>
          </div>
          <button onClick={openPastWeek} className="rounded-full bg-[#0071e3]/10 px-3 py-1 text-[11px] font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3]/20" type="button">
            Past Week Attendance
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[14px] font-semibold text-[#1d1d1f]">
            {selectedClassExists ? `No attendance submitted for ${filter} today yet.` : "No attendance has been submitted today yet."}
          </p>
          <p className="mt-1 text-[12px] font-medium text-[#86868b]">Past records are available from the weekly view.</p>
        </div>
        <PastWeekModal
          error={pastWeekError}
          loading={pastWeekLoading}
          onClose={() => setPastWeekOpen(false)}
          open={pastWeekOpen}
          rows={pastWeekRows}
        />
      </div>
    );
  }

  const W = 100, H = 48, pt = 4, pb = 2, bw = 4;
  const mx = Math.max(...d.map((v) => v.value), 100);
  const ph = H - pt - pb;
  const gap = (W - bw * d.length) / (d.length + 1);
  const gx = (i: number) => gap + i * (bw + gap) + bw / 2;
  const gy = (v: number) => pt + ph * (1 - v / mx);

  return (
    <div className="glass-card-interactive p-5 h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Overview</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="text-[10px] font-bold bg-[#f5f5f7] border border-[#e5e5ea] rounded-full px-2.5 py-1 text-[#0071e3] outline-none hover:bg-[#e8e8ed] transition-colors cursor-pointer"
          >
            <option value="All">All Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={openPastWeek} className="rounded-full bg-[#0071e3]/10 px-3 py-1 text-[11px] font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3]/20" type="button">Past Week Attendance</button>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0071e3" stopOpacity="0.15" /><stop offset="100%" stopColor="#0071e3" stopOpacity="0.01" /></linearGradient>
            <linearGradient id="bGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0071e3" stopOpacity="0.25" /><stop offset="100%" stopColor="#0071e3" stopOpacity="0.08" /></linearGradient>
          </defs>
          {[25, 50, 100].map((v) => <line key={v} x1="0" x2={W} y1={gy(v)} y2={gy(v)} stroke="#e8e8ed" strokeWidth="0.3" strokeDasharray="1.5 1" />)}
          {/* Custom red line for 75% bar */}
          <line x1="0" x2={W} y1={gy(75)} y2={gy(75)} stroke="#ff3b30" strokeWidth="0.5" strokeDasharray="1.5 1" />
          
          {d.map((v, i) => <rect key={v.label} x={gx(i) - bw / 2} y={on ? gy(v.value) : H - pb} width={bw} height={on ? (v.value / mx) * ph : 0} rx="1.5" fill="#0071e3" style={{ transition: `all 0.8s cubic-bezier(0.25,0.1,0.25,1) ${i * 0.06}s` }} />)}
          
          {/* Hit areas for hover */}
          {d.map((v, i) => (
            <rect
              key={`hit-${v.label}`}
              x={gx(i) - (bw + gap) / 2}
              y={0}
              width={bw + gap}
              height={H}
              fill="transparent"
              onMouseMove={(e) => {
                const card = e.currentTarget.closest(".glass-card-interactive");
                if (card) {
                  const rect = card.getBoundingClientRect();
                  setTooltip({ 
                    x: e.clientX - rect.left, 
                    y: e.clientY - rect.top, 
                    label: v.label, 
                    value: v.value 
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
              className="cursor-crosshair"
            />
          ))}
        </svg>
      </div>
      <div className="flex justify-between mt-2 px-1">
        {d.map((v) => <span key={v.label} className={`text-[10px] font-medium transition-colors duration-200 text-center ${tooltip?.label === v.label ? "text-[#1d1d1f]" : "text-[#86868b]"}`} style={{ width: `${100 / d.length}%` }}>{v.label}</span>)}
      </div>

      {/* Floating Tooltip */}
      {tooltip && (
        <div 
          className="absolute z-[100] pointer-events-none -translate-x-1/2 -translate-y-[calc(100%+12px)] bg-[#1d1d1f]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-[8px] text-[12px] font-medium shadow-xl flex items-center gap-2 border border-white/10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <span className="text-[#a1a1a6]">{tooltip.label}</span>
          <span className="font-bold text-white">{tooltip.value}%</span>
        </div>
      )}
      <PastWeekModal
        error={pastWeekError}
        loading={pastWeekLoading}
        onClose={() => setPastWeekOpen(false)}
        open={pastWeekOpen}
        rows={pastWeekRows}
      />
    </div>
  );
}

function PastWeekModal({
  error,
  loading,
  onClose,
  open,
  rows
}: {
  error: string;
  loading: boolean;
  onClose: () => void;
  open: boolean;
  rows: ClassesTodayReportRow[];
}) {
  if (!open) return null;

  const markedRows = rows.filter((row) => row.marked);
  const attended = markedRows.reduce((sum, row) => sum + row.attended, 0);
  const total = markedRows.reduce((sum, row) => sum + row.total, 0);
  const average = total ? Math.round((attended / total) * 1000) / 10 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button aria-label="Close past week attendance" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e5ea] px-6 py-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[#1d1d1f]">Past Week Attendance</h2>
            <p className="mt-1 text-[13px] font-medium text-[#86868b]">{isoDate(-6)} to {isoDate()}</p>
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
          ) : markedRows.length === 0 ? (
            <p className="rounded-xl bg-[#f5f5f7] px-4 py-5 text-center text-[13px] font-semibold text-[#5A6573]">No attendance was submitted in the past week.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#DCE1E8] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Average</p>
                  <p className="mt-1 text-[24px] font-bold text-[#1d1d1f]">{average}%</p>
                </div>
                <div className="rounded-xl border border-[#DCE1E8] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Marked classes</p>
                  <p className="mt-1 text-[24px] font-bold text-[#1d1d1f]">{markedRows.length}</p>
                </div>
                <div className="rounded-xl border border-[#DCE1E8] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868b]">Absent</p>
                  <p className="mt-1 text-[24px] font-bold text-[#d70015]">{markedRows.reduce((sum, row) => sum + row.absent, 0)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {markedRows.map((row) => (
                  <div key={row.classId} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#E5E8EF] px-4 py-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{row.className}</p>
                      <p className="mt-0.5 text-[12px] font-medium text-[#86868b]">Present {row.present + row.late}, half day {row.halfDay}, absent {row.absent}</p>
                    </div>
                    <span className="text-[16px] font-bold text-[#0071e3]">{row.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
