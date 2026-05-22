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
    <div className={`kpi-metric-card p-6 ${toneClasses[tone]}`}>
      <p className="kpi-metric-label">{label}</p>
      <p className="kpi-metric-value">{value}</p>
      {helper ? <p className="mt-1.5 text-[12px] text-[#86868b]">{helper}</p> : null}
    </div>
  );
}
