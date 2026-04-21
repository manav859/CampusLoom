type Props = {
  label: string;
  tone?: "good" | "warn" | "danger" | "neutral";
};

const styles = {
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  neutral: "bg-neutral-100 text-neutral-700"
};

export function StatusPill({ label, tone = "neutral" }: Props) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${styles[tone]}`}>{label}</span>;
}

