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

function pillIconType(label: string, tone: NonNullable<Props["tone"]>) {
  const normalized = label.trim().toUpperCase();
  if (normalized.includes("PAID") || normalized === "ACTIVE") return "check";
  if (normalized.includes("PARTIAL")) return "partial";
  if (normalized.includes("PENDING")) return "clock";
  if (normalized.includes("OVERDUE")) return "alert";
  if (tone === "good") return "check";
  if (tone === "warn") return "alert";
  if (tone === "danger") return "x";
  return "dot";
}

function StatusIcon({ label, tone }: { label: string; tone: NonNullable<Props["tone"]> }) {
  const type = pillIconType(label, tone);
  const className = "h-3 w-3";

  if (type === "check") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
    );
  }

  if (type === "partial") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5v11M8 8h5.5" />
      </svg>
    );
  }

  if (type === "clock") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3.5l2.5 1.5" />
      </svg>
    );
  }

  if (type === "alert") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M8 2.5 14 13H2L8 2.5Z" />
        <path d="M8 6v3M8 11.5h.01" />
      </svg>
    );
  }

  if (type === "x") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path d="m5 5 6 6M11 5l-6 6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  );
}

export function StatusPill({ label, tone = "neutral" }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption font-semibold transition-all duration-200 ease-apple ${styles[tone]}`}>
      <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/70">
        <StatusIcon label={label} tone={tone} />
      </span>
      {humanizeConstant(label)}
    </span>
  );
}
