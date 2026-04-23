type Props = {
  label: string;
  tone?: "good" | "warn" | "danger" | "neutral";
};

const styles = {
  good: "bg-[#34c759]/[0.12] text-[#248a3d] border border-[#34c759]/20",
  warn: "bg-[#ff9500]/[0.12] text-[#c93400] border border-[#ff9500]/20",
  danger: "bg-[#ff3b30]/[0.12] text-[#d70015] border border-[#ff3b30]/20",
  neutral: "bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.05)] text-[#6e6e73] border border-transparent"
};

export function StatusPill({ label, tone = "neutral" }: Props) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all duration-200 ease-apple ${styles[tone]}`}>
      {label}
    </span>
  );
}
