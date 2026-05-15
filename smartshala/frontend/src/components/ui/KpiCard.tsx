import Link from "next/link";
import type { Kpi } from "@/types";

const toneMap: Record<NonNullable<Kpi["tone"]>, { bg: string; border: string; value: string; bar: string; shadow: string }> = {
  neutral: { bg: "bg-gradient-to-br from-[#f5f5f7]/80 to-[#ffffff]/40", border: "border-[#e5e5ea]", value: "text-[#1d1d1f]", bar: "bg-gradient-to-b from-[#d2d2d7] to-[#aeaeb2]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_12px_-4px_rgba(0,0,0,0.05)]" },
  good: { bg: "bg-gradient-to-br from-[#34c759]/20 to-[#34c759]/5", border: "border-[#34c759]/20", value: "text-[#248a3d]", bar: "bg-gradient-to-b from-[#34c759] to-[#248a3d]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(52,199,89,0.2)]" },
  warn: { bg: "bg-gradient-to-br from-[#ff9500]/20 to-[#ff9500]/5", border: "border-[#ff9500]/20", value: "text-[#cc7700]", bar: "bg-gradient-to-b from-[#ff9500] to-[#cc7700]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(255,149,0,0.2)]" },
  danger: { bg: "bg-gradient-to-br from-[#ff3b30]/20 to-[#ff3b30]/5", border: "border-[#ff3b30]/20", value: "text-[#c90011]", bar: "bg-gradient-to-b from-[#ff3b30] to-[#c90011]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(255,59,48,0.2)]" },
  teal: { bg: "bg-gradient-to-br from-[#13bfa6]/20 to-[#13bfa6]/5", border: "border-[#13bfa6]/20", value: "text-[#0e9884]", bar: "bg-gradient-to-b from-[#13bfa6] to-[#0e9884]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(19,191,166,0.2)]" },
  green: { bg: "bg-gradient-to-br from-[#22a74c]/20 to-[#22a74c]/5", border: "border-[#22a74c]/20", value: "text-[#187d37]", bar: "bg-gradient-to-b from-[#22a74c] to-[#187d37]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(34,167,76,0.2)]" },
  red: { bg: "bg-gradient-to-br from-[#d63230]/20 to-[#d63230]/5", border: "border-[#d63230]/20", value: "text-[#b02725]", bar: "bg-gradient-to-b from-[#d63230] to-[#b02725]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(214,50,48,0.2)]" },
  amber: { bg: "bg-gradient-to-br from-[#eba931]/20 to-[#eba931]/5", border: "border-[#eba931]/20", value: "text-[#c28a25]", bar: "bg-gradient-to-b from-[#eba931] to-[#c28a25]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(235,169,49,0.2)]" },
  purple: { bg: "bg-gradient-to-br from-[#7e53db]/20 to-[#7e53db]/5", border: "border-[#7e53db]/20", value: "text-[#6341ac]", bar: "bg-gradient-to-b from-[#7e53db] to-[#6341ac]", shadow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-6px_rgba(126,83,219,0.2)]" }
};

export function KpiCard({ label, value, helper, formula, href, tone = "neutral" }: Kpi) {
  const styles = toneMap[tone];
  const content = (
    <div
      className={`relative overflow-hidden rounded-[16px] h-[86px] pl-[22px] pr-5 py-3.5 flex flex-col justify-between backdrop-blur-2xl border transition-transform duration-300 ${href ? "cursor-pointer hover:-translate-y-[3px] hover:shadow-xl" : ""} ${styles.border} ${styles.bg} ${styles.shadow}`}
      title={formula}
    >
      {/* Premium Gradient Left Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[6px] ${styles.bar}`} />
      {formula ? (
        <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[11px] font-bold text-[#6e6e73]">
          ?
        </span>
      ) : null}
      
      {/* Value */}
      <p className={`pr-7 text-[var(--type-kpi)] font-bold leading-[var(--leading-kpi)] tracking-normal tabular-nums ${styles.value}`}>{value}</p>
      
      {/* Label */}
      <div>
        <p className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-[#1d1d1f]/70">{label}</p>
        {helper ? <p className="mt-0.5 truncate text-[11px] font-medium text-[#5A6573]">{helper}</p> : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link aria-label={`${label} details`} className="block focus:outline-none focus:ring-2 focus:ring-[#2456E6]/40 focus:ring-offset-2 rounded-[16px]" href={href}>
        {content}
      </Link>
    );
  }

  return content;
}
