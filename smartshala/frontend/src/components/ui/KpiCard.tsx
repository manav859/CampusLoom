"use client";

import { useEffect, useRef, useState } from "react";
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

export function MarqueeText({ text, className = "" }: { text: string | number; className?: string }) {
  const value = String(text);
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const measureNode = measureRef.current;
    if (!container || !measureNode) return;

    const measure = () => setIsOverflowing(measureNode.scrollWidth > container.clientWidth + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(measureNode);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={containerRef} className={`relative block overflow-hidden whitespace-nowrap ${className}`} title={value}>
      <span ref={measureRef} className="invisible absolute whitespace-nowrap">{value}</span>
      {isOverflowing ? (
        <span className="inline-flex min-w-max gap-8 animate-kpi-marquee">
          <span>{value}</span>
          <span aria-hidden="true">{value}</span>
        </span>
      ) : (
        <span className="inline-block max-w-full">{value}</span>
      )}
    </span>
  );
}

export function KpiIcon({ label, className }: { label: string; className: string }) {
  const key = label.toLowerCase();

  if (key.includes("student") || key.includes("employee")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" aria-hidden="true">
        <circle cx="11" cy="11" r="4" />
        <circle cx="22" cy="12" r="3" />
        <path d="M4 25c.8-5 4-7.5 7-7.5s6.2 2.5 7 7.5" />
        <path d="M18 24c.7-3.6 2.8-5.4 5-5.4 2.5 0 4.5 2 5 5.4" />
      </svg>
    );
  }

  if (key.includes("fee") || key.includes("collected") || key.includes("paid") || key.includes("balance")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" aria-hidden="true">
        <path d="M6 10h20v14H6z" />
        <path d="M9 10V7h14v3" />
        <path d="M20 17h6" />
        <circle cx="13" cy="17" r="2.5" />
      </svg>
    );
  }

  if (key.includes("alert") || key.includes("risk") || key.includes("defaulter") || key.includes("pending") || key.includes("absent") || key.includes("missing") || key.includes("failed")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" aria-hidden="true">
        <path d="M16 5 29 27H3L16 5Z" />
        <path d="M16 12v7" />
        <path d="M16 23h.01" />
      </svg>
    );
  }

  if (key.includes("attendance") || key.includes("marked") || key.includes("present") || key.includes("working") || key.includes("time")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" aria-hidden="true">
        <rect x="6" y="7" width="20" height="19" rx="3" />
        <path d="M11 5v5M21 5v5M6 13h20" />
        <path d="m11 20 3 3 7-8" />
      </svg>
    );
  }

  if (key.includes("homework") || key.includes("class") || key.includes("exam") || key.includes("marks")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" aria-hidden="true">
        <path d="M8 6h12a4 4 0 0 1 4 4v16H12a4 4 0 0 0-4-4V6Z" />
        <path d="M8 22V10a4 4 0 0 1 4-4" />
        <path d="M13 13h6M13 18h5" />
      </svg>
    );
  }

  if (key.includes("rank") || key.includes("performance")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" aria-hidden="true">
        <path d="M10 6h12v5a6 6 0 0 1-12 0V6Z" />
        <path d="M10 9H5a5 5 0 0 0 5 5M22 9h5a5 5 0 0 1-5 5" />
        <path d="M16 17v5M11 26h10M13 22h6" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" aria-hidden="true">
      <path d="M7 23V12" />
      <path d="M16 23V7" />
      <path d="M25 23V16" />
      <path d="M5 25h22" />
    </svg>
  );
}

export function KpiCard({ label, value, helper, formula, href, tone = "neutral" }: Kpi) {
  const styles = toneMap[tone];
  const content = (
    <div
      className={`relative flex h-[112px] items-center gap-4 overflow-visible rounded-[6px] border border-[#E2E7EE] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)] transition-colors duration-200 ${href ? "cursor-pointer" : ""} ${styles.hover}`}
    >
      <div className={`hidden h-14 w-14 shrink-0 items-center justify-center rounded-[8px] sm:flex ${styles.iconBg}`}>
        <KpiIcon label={label} className={`h-6 w-6 ${styles.accent}`} />
      </div>
      {formula ? (
        <span className="group/tooltip absolute right-4 top-4 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#9AA5B1] bg-white text-[11px] font-bold text-[#6B7785]">
          ?
          <span className="pointer-events-none absolute right-0 top-7 z-30 w-64 rounded-md border border-[#DCE1E8] bg-white px-3 py-2 text-left text-[12px] font-medium leading-5 text-[#2A3340] opacity-0 shadow-[0_12px_32px_-12px_rgba(15,20,25,0.35)] group-hover/tooltip:opacity-100 group-focus/tooltip:opacity-100">
            {formula}
          </span>
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <MarqueeText text={label} className="pr-7 text-[15px] font-medium leading-6 text-[#52687D]" />
        <MarqueeText text={value} className="mt-0.5 text-[27px] font-semibold leading-8 tracking-normal text-[#0F2233] [font-variant-numeric:tabular-nums]" />
        {helper ? <MarqueeText text={helper} className="mt-1 text-[12px] font-medium leading-4 text-[#5A6573]" /> : null}
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
