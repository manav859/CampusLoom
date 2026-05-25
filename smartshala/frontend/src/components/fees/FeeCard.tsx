type FeeCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "neutral" | "good" | "warn" | "danger";
};

const toneClasses: Record<NonNullable<FeeCardProps["tone"]>, string> = {
  neutral: "",
  good: "kpi-metric-card-good",
  warn: "kpi-metric-card-warn",
  danger: "kpi-metric-card-danger"
};

export function FeeCard({ label, value, helper, tone = "neutral" }: FeeCardProps) {
  return (
    <div className={`kpi-metric-card min-w-0 p-4 sm:p-6 ${toneClasses[tone]}`}>
      <p className="kpi-metric-label">{label}</p>
      <p className="kpi-metric-value text-[22px] leading-7 sm:text-[27px] sm:leading-9" title={String(value)}>{value}</p>
      {helper ? <p className="mt-1.5 line-clamp-2 text-[12px] leading-4 text-[#86868b]">{helper}</p> : null}
    </div>
  );
}
