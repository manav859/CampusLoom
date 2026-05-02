"use client";

type AttendanceSummaryProps = {
  total: number;
  present: number;
  absent: number;
  late: number;
};

export function AttendanceSummary({ total, present, absent, late }: AttendanceSummaryProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="glass-card-interactive p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Total</p>
        <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{total}</p>
      </div>
      <div className="glass-card-interactive p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#248a3d]">Present</p>
        <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{present}</p>
      </div>
      <div className="glass-card-interactive p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#d70015]">Absent</p>
        <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{absent}</p>
      </div>
      <div className="glass-card-interactive p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#c93400]">Late</p>
        <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{late}</p>
      </div>
    </div>
  );
}
