"use client";

type AttendanceSummaryProps = {
  total: number;
  present: number;
  absent: number;
  late: number;
  halfDay?: number;
  attended?: number;
};

export function AttendanceSummary({ total, present, absent, late, halfDay = 0, attended }: AttendanceSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="kpi-metric-card p-4 sm:p-5">
        <p className="kpi-metric-label">Total</p>
        <p className="kpi-metric-value">{total}</p>
      </div>
      <div className="kpi-metric-card kpi-metric-card-good p-4 sm:p-5">
        <p className="kpi-metric-label">Present</p>
        <p className="kpi-metric-value">{present}</p>
      </div>
      <div className="kpi-metric-card kpi-metric-card-danger p-4 sm:p-5">
        <p className="kpi-metric-label">Absent</p>
        <p className="kpi-metric-value">{absent}</p>
      </div>
      <div className="kpi-metric-card kpi-metric-card-warn p-4 sm:p-5">
        <p className="kpi-metric-label">Late</p>
        <p className="kpi-metric-value">{late}</p>
      </div>
      <div className="kpi-metric-card kpi-metric-card-purple p-4 sm:p-5 col-span-2 sm:col-span-1">
        <p className="kpi-metric-label">Half day</p>
        <p className="kpi-metric-value">{halfDay}</p>
        {attended !== undefined ? <p className="mt-1 text-[11px] font-medium text-[#86868b]">{attended} attended</p> : null}
      </div>
    </div>
  );
}
