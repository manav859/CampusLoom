import Link from "next/link";
import type { Kpi } from "@/types";

const toneMap: Record<NonNullable<Kpi["tone"]>, { hover: string; accent: string; iconBg: string }> = {
  neutral: { hover: "hover:border-[#8C96A3]", accent: "text-[#5A6573]", iconBg: "bg-[#F2F5F8]" },
  good: { hover: "hover:border-[#0F8A4A]", accent: "text-[#0F8A4A]", iconBg: "bg-[#E1F5EA]" },
  warn: { hover: "hover:border-[#B95A00]", accent: "text-[#B95A00]", iconBg: "bg-[#FFF2DC]" },
  danger: { hover: "hover:border-[#C8242C]", accent: "text-[#C8242C]", iconBg: "bg-[#FCE3E5]" },
  teal: { hover: "hover:border-[#0E9884]", accent: "text-[#0E9884]", iconBg: "bg-[#E2F7F4]" },
  green: { hover: "hover:border-[#0F8A4A]", accent: "text-[#0F8A4A]", iconBg: "bg-[#E1F5EA]" },
  red: { hover: "hover:border-[#C8242C]", accent: "text-[#C8242C]", iconBg: "bg-[#FCE3E5]" },
  amber: { hover: "hover:border-[#B95A00]", accent: "text-[#B95A00]", iconBg: "bg-[#FFF2DC]" },
  purple: { hover: "hover:border-[#7C3AED]", accent: "text-[#7C3AED]", iconBg: "bg-[#EFE9FF]" }
};

export function KpiCard({ label, value, helper, formula, href, tone = "neutral" }: Kpi) {
  const styles = toneMap[tone];
  const content = (
    <div
      className={`group relative flex min-h-[120px] items-center gap-5 rounded-[6px] border border-[#E2E7EE] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)] transition-colors duration-200 ${href ? "cursor-pointer" : ""} ${styles.hover}`}
      title={formula}
    >
      <div className={`hidden h-[70px] w-[70px] shrink-0 items-center justify-center rounded-[8px] sm:flex ${styles.iconBg}`}>
        <svg className={`h-8 w-8 ${styles.accent}`} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" aria-hidden="true">
          <path d="M7 23V12" />
          <path d="M16 23V7" />
          <path d="M25 23V16" />
          <path d="M5 25h22" />
        </svg>
      </div>
      {formula ? (
        <span className="absolute right-4 top-4 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#9AA5B1] bg-white text-[11px] font-bold text-[#6B7785]">
          ?
        </span>
      ) : null}

      <div className="min-w-0">
        <p className="pr-7 text-[16px] font-medium leading-6 text-[#52687D]">{label}</p>
        <p className="mt-1 text-[30px] font-semibold leading-9 tracking-normal text-[#0F2233] [font-variant-numeric:tabular-nums]">{value}</p>
        {helper ? <p className="mt-1 truncate text-caption text-[#5A6573]">{helper}</p> : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link aria-label={`${label} details`} className="block rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2456E6]/40 focus:ring-offset-2" href={href}>
        {content}
      </Link>
    );
  }

  return content;
}
