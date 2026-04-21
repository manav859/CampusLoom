"use client";

type AttendanceSummaryProps = {
  total: number;
  present: number;
  absent: number;
};

export function AttendanceSummary({ total, present, absent }: AttendanceSummaryProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-line bg-panel p-3">
        <p className="text-xs font-medium text-neutral-500">Total</p>
        <p className="mt-1 text-2xl font-bold text-ink">{total}</p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-medium text-emerald-700">Present</p>
        <p className="mt-1 text-2xl font-bold text-emerald-900">{present}</p>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
        <p className="text-xs font-medium text-red-700">Absent</p>
        <p className="mt-1 text-2xl font-bold text-red-900">{absent}</p>
      </div>
    </div>
  );
}
