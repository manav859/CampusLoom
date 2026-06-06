type FeeCardProps = {
  label: string;
  value: string | number;
  exact?: string;
  helper?: string;
  tone?: "neutral" | "good" | "warn" | "danger";
};

const toneClasses: Record<NonNullable<FeeCardProps["tone"]>, string> = {
  neutral: "",
  good: "kpi-metric-card-good",
  warn: "kpi-metric-card-warn",
  danger: "kpi-metric-card-danger"
};

export function FeeCard({ label, value, exact, helper, tone = "neutral" }: FeeCardProps) {
  return (
    <div className={`kpi-metric-card group relative flex !h-[132px] min-w-0 flex-col justify-between p-4 sm:!h-[128px] sm:p-6 ${toneClasses[tone]}`}>
      <div className="min-w-0">
        <p className="kpi-metric-label">{label}</p>
        <p className="kpi-metric-value text-[22px] leading-7 sm:text-[27px] sm:leading-9">{value}</p>
      </div>
      <p className={`min-h-4 line-clamp-1 text-[12px] leading-4 text-[#86868b] ${helper ? "" : "invisible"}`}>{helper ?? "No helper"}</p>
      {exact ? (
        <span className="pointer-events-none absolute bottom-full left-4 z-30 mb-2 -translate-y-1 whitespace-nowrap rounded-md bg-[#0F2233] px-2.5 py-1.5 text-[12px] font-semibold leading-4 text-white opacity-0 shadow-[0_12px_32px_-12px_rgba(15,20,25,0.55)] transition-all duration-150 group-hover:-translate-y-0 group-hover:opacity-100">
          {exact}
          <span className="absolute left-5 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 bg-[#0F2233]" />
        </span>
      ) : null}
    </div>
  );
}
