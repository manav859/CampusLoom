type FeeCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "neutral" | "good" | "warn" | "danger";
};

const toneColors: Record<NonNullable<FeeCardProps["tone"]>, string> = {
  neutral: "bg-[#d2d2d7]",
  good: "bg-[#34c759]",
  warn: "bg-[#ff9500]",
  danger: "bg-[#ff3b30]"
};

export function FeeCard({ label, value, helper, tone = "neutral" }: FeeCardProps) {
  return (
    <div className="glass-card-interactive p-6">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${toneColors[tone]}`} />
        <p className="text-[13px] font-medium text-[#86868b]">{label}</p>
      </div>
      <p className="mt-3 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{value}</p>
      {helper ? <p className="mt-1.5 text-[12px] text-[#86868b]">{helper}</p> : null}
    </div>
  );
}
