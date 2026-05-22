"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
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

export default function AnalyticsPage() {
  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [classes, setClasses] = useState<ClassPerformance[]>([]);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

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

  function markResolved(id: string) {
    const next = Array.from(new Set([...resolvedIds, id]));
    setResolvedIds(next);
    window.localStorage.setItem("smartshala.resolvedRiskIds", JSON.stringify(next));
    setNotice("Priority row marked resolved for this device.");
  }

  async function messageParent(row: RiskRow) {
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
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
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

      <p className="max-w-3xl text-[14px] leading-6 text-[#5A6573]">
        {risk?.principalSummary ?? "Loading risk signals..."}
      </p>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Below 75%" value={risk?.lowAttendanceCount ?? "..."} helper={risk ? trendText(risk.trends.lowAttendance) : undefined} tone="danger" />
        <KpiCard label="Combined risk" value={risk?.combinedRiskCount ?? "..."} tone="danger" />
        <KpiCard label="Repeat absentees" value={risk?.repeatAbsenteeCount ?? "..."} tone="warn" />
        <KpiCard label="High severity" value={risk?.severityCounts.HIGH ?? "..."} tone="danger" />
        <KpiCard label="Medium severity" value={risk?.severityCounts.MEDIUM ?? "..."} tone="warn" />
        <KpiCard label="Low severity" value={risk?.severityCounts.LOW ?? "..."} helper={risk ? trendText(risk.trends.totalRisk) : undefined} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Class performance</h2>
          <div className="mt-5">
            <SimpleBarChart items={classes.map((item) => ({ label: item.className, value: item.attendancePercentage }))} />
          </div>
        </div>
        <div className="glass-card-interactive p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Priority students</h2>
            <StatusPill label={`${visibleRisks.length} open`} tone={visibleRisks.length ? "warn" : "good"} />
          </div>
          <div className="mt-5 space-y-3">
            {visibleRisks.length === 0 ? (
              <div className="rounded-xl bg-[#E1F5EA] p-4 text-[13px] font-semibold text-[#0F8A4A]">No open priority risks.</div>
            ) : visibleRisks.map((row) => (
              <div key={row.studentId} className="rounded-xl border border-[#DCE1E8] bg-white px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
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
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button className="btn-secondary min-h-9 px-3 text-[12px]" disabled={!row.parentPhone || sendingId === row.studentId} onClick={() => messageParent(row)} type="button">
                      {sendingId === row.studentId ? "Sending..." : "Message parent"}
                    </button>
                    <Link className="btn-secondary min-h-9 px-3 text-[12px]" href={`/students/${row.studentId}`}>View profile</Link>
                    <button className="btn-secondary min-h-9 px-3 text-[12px]" onClick={() => markResolved(row.studentId)} type="button">Mark resolved</button>
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
