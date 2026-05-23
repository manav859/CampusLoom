"use client";

type AttendanceSummaryProps = {
  total: number;
  present: number;
  absent: number;
  late: number;
  halfDay?: number;
  attended?: number;
  layout?: "grid" | "rail";
  pending?: boolean;
};

function metricCardClasses(layout: AttendanceSummaryProps["layout"], tone?: string) {
  const base = `kpi-metric-card ${tone ?? ""}`;
  if (layout === "rail") return `${base} flex h-auto min-h-[72px] items-center justify-between gap-3 p-4`;
  return `${base} p-5`;
}

export function AttendanceSummary({ total, present, absent, late, halfDay = 0, attended, layout = "grid", pending = false }: AttendanceSummaryProps) {
  return (
    <div className={layout === "rail" ? "grid gap-3 sm:grid-cols-5 lg:grid-cols-1" : "grid gap-3 sm:grid-cols-5"}>
      <div className={metricCardClasses(layout)}>
        <div>
          <p className="kpi-metric-label">Total</p>
          {pending ? <p className="mt-1 text-[11px] font-medium text-[#B95A00]">Attendance pending</p> : null}
        </div>
        <p className="kpi-metric-value">{total}</p>
      </div>
      <div className={metricCardClasses(layout, "kpi-metric-card-good")}>
        <p className="kpi-metric-label">Present</p>
        <p className="kpi-metric-value">{present}</p>
      </div>
      <div className={metricCardClasses(layout, "kpi-metric-card-danger")}>
        <p className="kpi-metric-label">Absent</p>
        <p className="kpi-metric-value">{absent}</p>
      </div>
      <div className={metricCardClasses(layout, "kpi-metric-card-warn")}>
        <p className="kpi-metric-label">Late</p>
        <p className="kpi-metric-value">{late}</p>
      </div>
      <div className={metricCardClasses(layout, "kpi-metric-card-purple")}>
        <div>
          <p className="kpi-metric-label">Half day</p>
          {pending ? <p className="mt-1 text-[11px] font-medium text-[#B95A00]">Attendance pending</p> : attended !== undefined ? <p className="mt-1 text-[11px] font-medium text-[#86868b]">{attended} attended</p> : null}
        </div>
        <p className="kpi-metric-value">{halfDay}</p>
      </div>
    </div>
  );
}
