import type { Kpi } from "@/types";

const toneMap: Record<NonNullable<Kpi["tone"]>, string> = {
  neutral: "border-line bg-panel",
  good: "border-emerald-200 bg-emerald-50",
  warn: "border-amber-200 bg-amber-50",
  danger: "border-red-200 bg-red-50"
};

export function KpiCard({ label, value, tone = "neutral" }: Kpi) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneMap[tone]}`}>
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

