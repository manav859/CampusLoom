"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch, whatsappApi } from "@/lib/api";
import { formatINR } from "@/lib/formatters";

type Severity = "HIGH" | "MEDIUM" | "LOW";
type RiskRow = {
  studentId: string;
  studentName: string;
  parentPhone: string | null;
  className: string;
  attendancePercentage: number;
  absentThisMonth: number;
  pendingFees: number;
  flags: string[];
  severity: Severity;
  explainers: string[];
};
type Trend = { current: number; previous: number; delta: number; direction: "up" | "down" | "flat" };
type RiskSummary = {
  lowAttendanceCount: number;
  combinedRiskCount: number;
  repeatAbsenteeCount: number;
  principalSummary: string;
  severityCounts: Record<Severity, number>;
  trends: { lowAttendance: Trend; totalRisk: Trend };
  studentRisks: RiskRow[];
};
type ClassPerformance = {
  classId: string;
  className: string;
  studentCount: number;
  markedDays: number;
  attendancePercentage: number;
  status: string;
};

const severityTone = {
  HIGH: "danger",
  MEDIUM: "warn",
  LOW: "neutral"
} as const;

function flagLabel(flag: string) {
  return flag.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function trendText(trend: Trend) {
  const direction = trend.direction === "up" ? "up" : trend.direction === "down" ? "down" : "flat";
  const delta = trend.delta > 0 ? `+${trend.delta}` : String(trend.delta);
  return `${trend.current} ${direction} ${delta} vs last week`;
}

function downloadCsv(rows: RiskRow[]) {
  const csvRows = [
    ["Student", "Class", "Severity", "Attendance %", "Absences", "Pending Fees", "Flags"],
    ...rows.map((row) => [
      row.studentName,
      row.className,
      row.severity,
      row.attendancePercentage,
      row.absentThisMonth,
      formatINR(row.pendingFees),
      row.flags.map(flagLabel).join("; ")
    ])
  ];
  const csv = csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `risk-insights-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type AnalyticsKpi = {
  helper?: string;
  icon: "attendance" | "combined" | "repeat" | "high" | "medium" | "low";
  label: string;
  tone: "danger" | "warn" | "neutral";
  value: number | string;
};

const kpiToneStyles = {
  danger: {
    border: "border-[#C8242C]",
    iconBg: "bg-[#FCE3E5]",
    iconText: "text-[#C8242C]"
  },
  warn: {
    border: "border-[#B95A00]",
    iconBg: "bg-[#FFF2DC]",
    iconText: "text-[#B95A00]"
  },
  neutral: {
    border: "border-[#8C96A3]",
    iconBg: "bg-[#F2F5F8]",
    iconText: "text-[#5A6573]"
  }
};

// Plain-language explanations shown on hover/tap so anyone can understand each card.
const kpiInfo: Record<AnalyticsKpi["icon"], { title: string; description: string }> = {
  attendance: {
    title: "Attendance below 75%",
    description: "Students who came to school on fewer than 75 out of every 100 days. They are missing a lot of class and may start falling behind."
  },
  combined: {
    title: "Combined risk",
    description: "Students with two problems at the same time — low attendance and unpaid fees. Help these students first."
  },
  repeat: {
    title: "Repeat absentees",
    description: "Students who have stayed absent again and again — not just once or twice. Usually a sign of a bigger problem at home or in class."
  },
  high: {
    title: "High severity",
    description: "The most serious cases. Call or meet these families today."
  },
  medium: {
    title: "Medium severity",
    description: "Cases worth watching. Follow up this week, before they get worse."
  },
  low: {
    title: "Low severity",
    description: "Small concerns only. Just keep an eye on these students — no urgent action needed."
  }
};

function AnalyticsKpiIcon({ type, className }: { type: AnalyticsKpi["icon"]; className: string }) {
  if (type === "attendance") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <rect x="6" y="7" width="20" height="19" rx="3" />
        <path d="M11 5v5M21 5v5M6 13h20" />
        <path d="m11 21 3 3 7-8" />
      </svg>
    );
  }

  if (type === "combined") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path d="M16 5 29 27H3L16 5Z" />
        <path d="M16 12v7M16 23h.01" />
        <circle cx="8" cy="24" r="2" />
        <circle cx="24" cy="24" r="2" />
      </svg>
    );
  }

  if (type === "repeat") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path d="M25 10a10 10 0 1 0 2 11" />
        <path d="M25 5v5h-5" />
        <path d="M16 10v7l5 3" />
      </svg>
    );
  }

  if (type === "high") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path d="M9 24V13a7 7 0 0 1 14 0v11" />
        <path d="M5 24h22M12 28h8" />
        <path d="M6 10 3 7M26 10l3-3M16 3V1" />
      </svg>
    );
  }

  if (type === "medium") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path d="M16 6 28 27H4L16 6Z" />
        <path d="M16 13v6M16 23h.01" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
      <path d="M16 4 26 8v8c0 6-4.2 10-10 12C10.2 26 6 22 6 16V8l10-4Z" />
      <path d="m11 16 3 3 7-8" />
    </svg>
  );
}

function AnalyticsKpiCard({ helper, icon, label, tone, value }: AnalyticsKpi) {
  const styles = kpiToneStyles[tone];
  const info = kpiInfo[icon];

  return (
    <div
      aria-label={`${label}. ${info.description}`}
      className={`group relative z-0 flex h-[112px] min-w-0 cursor-help items-center gap-3 rounded-[8px] border bg-white p-4 shadow-[var(--shadow-card)] outline-none transition-shadow hover:z-30 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-[#2456E6]/30 sm:gap-4 sm:p-5 ${styles.border}`}
      tabIndex={0}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] sm:h-14 sm:w-14 ${styles.iconBg}`}>
        <AnalyticsKpiIcon type={icon} className={`h-6 w-6 sm:h-7 sm:w-7 ${styles.iconText}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold leading-5 text-[#52687D] sm:text-[15px]">{label}</p>
        <p className="mt-1 truncate text-[26px] font-bold leading-8 text-[#0F1419] [font-variant-numeric:tabular-nums]">{value}</p>
        {helper ? <p className="mt-0.5 truncate text-[12px] font-semibold leading-4 text-[#5A6573]" title={helper}>{helper}</p> : null}
      </div>

      <span
        aria-hidden="true"
        className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border border-[#C9D3DE] text-[10px] font-bold italic leading-none text-[#8C96A3] transition-colors group-hover:border-[#2456E6] group-hover:text-[#2456E6]"
      >
        i
      </span>

      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-[260px] max-w-[78vw] -translate-x-1/2 translate-y-1 rounded-[10px] border border-[#E3E8EF] bg-white p-3 text-left opacity-0 shadow-[0_16px_40px_-12px_rgba(15,20,25,0.35)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        <p className={`text-[13px] font-bold ${styles.iconText}`}>{info.title}</p>
        <p className="mt-1 text-[12.5px] leading-5 text-[#424B57]">{info.description}</p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [classes, setClasses] = useState<ClassPerformance[]>([]);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("smartshala.resolvedRiskIds");
    if (saved) {
      try {
        setResolvedIds(JSON.parse(saved));
      } catch {
        setResolvedIds([]);
      }
    }

    Promise.all([
      apiFetch<RiskSummary>("/analytics/risk-summary"),
      apiFetch<ClassPerformance[]>("/analytics/classes")
    ])
      .then(([riskData, classData]) => {
        setRisk(riskData);
        setClasses(classData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load analytics"));
  }, []);

  const visibleRisks = useMemo(
    () => (risk?.studentRisks ?? []).filter((row) => !resolvedIds.includes(row.studentId)),
    [resolvedIds, risk?.studentRisks]
  );
  const kpis: AnalyticsKpi[] = [
    { icon: "attendance", label: "Below 75%", value: risk?.lowAttendanceCount ?? "...", helper: risk ? trendText(risk.trends.lowAttendance) : undefined, tone: "danger" },
    { icon: "combined", label: "Combined risk", value: risk?.combinedRiskCount ?? "...", tone: "danger" },
    { icon: "repeat", label: "Repeat absentees", value: risk?.repeatAbsenteeCount ?? "...", tone: "warn" },
    { icon: "high", label: "High severity", value: risk?.severityCounts.HIGH ?? "...", tone: "danger" },
    { icon: "medium", label: "Medium severity", value: risk?.severityCounts.MEDIUM ?? "...", tone: "warn" },
    { icon: "low", label: "Low severity", value: risk?.severityCounts.LOW ?? "...", helper: risk ? trendText(risk.trends.totalRisk) : undefined, tone: "neutral" }
  ];

  function markResolved(id: string) {
    const next = Array.from(new Set([...resolvedIds, id]));
    setResolvedIds(next);
    window.localStorage.setItem("smartshala.resolvedRiskIds", JSON.stringify(next));
    setOpenActionMenuId(null);
    setNotice("Priority row marked resolved for this device.");
  }

  async function messageParent(row: RiskRow) {
    setOpenActionMenuId(null);
    if (!row.parentPhone) {
      setError(`${row.studentName} does not have a parent phone number.`);
      return;
    }
    setSendingId(row.studentId);
    setError("");
    try {
      await whatsappApi.send({
        phone: row.parentPhone,
        message: `Dear Parent, SmartShala has flagged ${row.studentName} for follow-up: ${row.explainers.join(", ")}. Please contact the school office.`
      });
      setNotice(`WhatsApp message sent to ${row.studentName}'s parent.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send WhatsApp message");
    } finally {
      setSendingId(null);
    }
  }

  async function bulkMessageParents() {
    const messageableRows = visibleRisks.filter((row): row is RiskRow & { parentPhone: string } => Boolean(row.parentPhone));
    if (messageableRows.length === 0) {
      setError("No priority parent phone numbers found.");
      return;
    }
    setBulkSending(true);
    setError("");
    try {
      await Promise.all(messageableRows.map((row) => whatsappApi.send({
        phone: row.parentPhone,
        message: `Dear Parent, SmartShala has flagged ${row.studentName} for follow-up: ${row.explainers.join(", ")}. Please contact the school office.`
      })));
      setNotice(`Bulk WhatsApp sent to ${messageableRows.length} priority parents.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send bulk WhatsApp messages");
    } finally {
      setBulkSending(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Attendance and Fee Risk Insights"
        action={
          <>
            <button className="btn-secondary" onClick={() => downloadCsv(visibleRisks)} type="button">Export CSV</button>
            <button className="btn-primary" disabled={bulkSending || !visibleRisks.some((row) => row.parentPhone)} onClick={bulkMessageParents} type="button">
              {bulkSending ? "Sending..." : "Bulk WhatsApp"}
            </button>
          </>
        }
      />
      {notice ? <div className="rounded-xl bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">{notice}</div> : null}
      {error ? <div className="rounded-xl bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}

      <p className="rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-3 text-[14px] leading-6 text-[#5A6573] shadow-[var(--shadow-card)]">
        {risk?.principalSummary ?? "Loading risk signals..."}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((item) => <AnalyticsKpiCard key={item.label} {...item} />)}
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)] sm:p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Class Performance</h2>
          <div className="mt-5 max-h-[420px] overflow-y-auto pr-1">
            <SimpleBarChart items={classes.map((item) => ({ label: item.className, value: item.attendancePercentage }))} />
          </div>
        </div>
        <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Priority Students</h2>
            <StatusPill label={`${visibleRisks.length} open`} tone={visibleRisks.length ? "warn" : "good"} />
          </div>
          <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {visibleRisks.length === 0 ? (
              <div className="rounded-[8px] bg-[#E1F5EA] p-4 text-[13px] font-semibold text-[#0F8A4A]">No open priority risks.</div>
            ) : visibleRisks.map((row) => (
              <div key={row.studentId} className="relative rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,20,25,0.03)]">
                <button
                  aria-expanded={openActionMenuId === row.studentId}
                  aria-label={`Open actions for ${row.studentName}`}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#DCE1E8] bg-white text-[#5A6573] shadow-[0_1px_2px_rgba(15,20,25,0.04)] hover:bg-[#F7F8FB] sm:hidden"
                  onClick={() => setOpenActionMenuId((current) => current === row.studentId ? null : row.studentId)}
                  type="button"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                    <circle cx="8" cy="3" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="8" cy="13" r="1.5" />
                  </svg>
                </button>
                {openActionMenuId === row.studentId ? (
                  <div className="absolute right-3 top-12 z-30 w-[min(230px,calc(100vw-3rem))] overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white p-1.5 shadow-[var(--shadow-menu)] sm:hidden">
                    <button
                      className="flex min-h-10 w-full items-center gap-2 rounded-[6px] px-3 text-left text-[13px] font-semibold text-[#2456E6] hover:bg-[#E2F0FB] disabled:cursor-not-allowed disabled:text-[#8C96A3]"
                      disabled={!row.parentPhone || sendingId === row.studentId}
                      onClick={() => messageParent(row)}
                      type="button"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#2456E6]" />
                      {sendingId === row.studentId ? "Sending..." : "Message parent"}
                    </button>
                    <Link
                      className="flex min-h-10 w-full items-center gap-2 rounded-[6px] px-3 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
                      href={`/students/${row.studentId}`}
                      onClick={() => setOpenActionMenuId(null)}
                    >
                      <span className="h-2 w-2 rounded-full bg-[#5A6573]" />
                      View profile
                    </Link>
                    <button
                      className="flex min-h-10 w-full items-center gap-2 rounded-[6px] px-3 text-left text-[13px] font-semibold text-[#0F8A4A] hover:bg-[#E1F5EA]"
                      onClick={() => markResolved(row.studentId)}
                      type="button"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#0F8A4A]" />
                      Mark resolved
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 pr-9 sm:pr-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{row.studentName}</p>
                      <StatusPill label={row.severity} tone={severityTone[row.severity]} />
                      <span className="text-[12px] font-medium text-[#86868b]">{row.className}</span>
                    </div>
                    <p className="mt-2 text-[12px] font-semibold text-[#5A6573]">Why is this student at risk?</p>
                    <ul className="mt-1 space-y-1 text-[12px] leading-5 text-[#5A6573]">
                      {row.explainers.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.flags.map((flag) => <span className="rounded-md bg-[#F7F8FB] px-2 py-1 text-[11px] font-semibold text-[#5A6573]" key={flag}>{flagLabel(flag)}</span>)}
                    </div>
                  </div>
                  <div className="hidden shrink-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                    <button className="btn-secondary min-h-9 px-3 text-[12px]" disabled={!row.parentPhone || sendingId === row.studentId} onClick={() => messageParent(row)} type="button">
                      {sendingId === row.studentId ? "Sending..." : "Message parent"}
                    </button>
                    <Link className="btn-secondary min-h-9 px-3 text-[12px]" href={`/students/${row.studentId}`}>View profile</Link>
                    <button className="btn-secondary min-h-9 px-3 text-[12px]" onClick={() => markResolved(row.studentId)} type="button">Mark Resolved</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
