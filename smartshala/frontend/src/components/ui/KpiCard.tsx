import type { Kpi } from "@/types";

const toneColors: Record<NonNullable<Kpi["tone"]>, { dot: string; value: string; color: string }> = {
  neutral: { dot: "bg-[#d2d2d7]", value: "text-inherit", color: "#d2d2d7" },
  good: { dot: "bg-[#34c759]", value: "text-inherit", color: "#34c759" },
  warn: { dot: "bg-[#ff9500]", value: "text-inherit", color: "#ff9500" },
  danger: { dot: "bg-[#ff3b30]", value: "text-inherit", color: "#ff3b30" }
};

export function KpiCard({ label, value, tone = "neutral" }: Kpi) {
  const colors = toneColors[tone];
  return (
    <div className="glass-card-interactive p-6 group">
      <div className="flex items-center gap-2">
        <span className={`indicator-dot ${colors.dot}`} style={{ color: colors.color }} />
        <p className="text-[11px] font-bold tracking-[0.05em] text-[#86868b] uppercase">{label}</p>
      </div>
      <p className="mt-3 text-[32px] font-semibold tracking-tight transition-colors duration-300 text-inherit">{value}</p>
    </div>
  );
}
