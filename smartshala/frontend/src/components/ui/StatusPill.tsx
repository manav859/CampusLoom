import { humanizeConstant } from "@/lib/formatters";

type Props = {
  label: string;
  tone?: "good" | "warn" | "danger" | "neutral";
};

const styles = {
  good: "bg-[var(--success-100)] text-[var(--success-600)] border border-[color:rgb(15_138_74/20%)]",
  warn: "bg-[var(--warning-100)] text-[var(--warning-600)] border border-[color:rgb(185_90_0/20%)]",
  danger: "bg-[var(--danger-100)] text-[var(--danger-600)] border border-[color:rgb(200_36_44/20%)]",
  neutral: "bg-[var(--surface-50)] text-[var(--ink-500)] border border-[var(--border-200)]"
};

const symbols = {
  good: "✓",
  warn: "!",
  danger: "×",
  neutral: "•"
};

export function StatusPill({ label, tone = "neutral" }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption font-semibold transition-all duration-200 ease-apple ${styles[tone]}`}>
      <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/70 text-[10px] leading-none">
        {symbols[tone]}
      </span>
      {humanizeConstant(label)}
    </span>
  );
}
