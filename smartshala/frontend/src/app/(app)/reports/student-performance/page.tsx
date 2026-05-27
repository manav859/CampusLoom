"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/formatters";
import { downloadCsv, percent, ReportTable } from "@/features/reports/reportUtils";

type StudentPerformanceRow = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  attendancePercentage?: number | null;
  performanceRate?: number | null;
  performanceClassification?: "Excellent" | "Good" | "Needs Attention" | "At Risk" | null;
  pendingAmount?: number | null;
  feeBalance?: number | null;
  isActive: boolean;
};

function performanceTone(label: StudentPerformanceRow["performanceClassification"]) {
  if (label === "Excellent" || label === "Good") return "good";
  if (label === "Needs Attention") return "warn";
  if (label === "At Risk") return "danger";
  return "neutral";
}

export default function StudentPerformanceReportPage() {
  const [rows, setRows] = useState<StudentPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: "100", page: "1" });
        const data = await apiFetch<{ items: StudentPerformanceRow[] }>(`/students?${params.toString()}`);
        if (active) setRows(data.items);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load student performance report");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (b.performanceRate ?? b.attendancePercentage ?? 0) - (a.performanceRate ?? a.attendancePercentage ?? 0)),
    [rows]
  );

  function exportCsv() {
    downloadCsv(`student-performance-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Student", "Admission no", "Class", "Attendance", "Performance", "Classification", "Fee balance", "Status"],
      ...sortedRows.map((row) => [
        row.fullName,
        row.admissionNumber,
        `${row.class.name}-${row.class.section}`,
        percent(row.attendancePercentage),
        percent(row.performanceRate),
        row.performanceClassification ?? "Not available",
        row.pendingAmount ?? row.feeBalance ?? 0,
        row.isActive ? "Active" : "Inactive"
      ])
    ]);
  }

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Student performance report"
        action={<button className="btn-primary min-h-10 px-4 text-[13px]" disabled={loading || rows.length === 0} onClick={exportCsv} type="button">Export CSV</button>}
      />
      <ReportTable colSpan={8} empty={loading ? "Loading students..." : "No students found."} isEmpty={loading || sortedRows.length === 0} minWidth="min-w-[980px]">
        {!loading && sortedRows.length > 0 ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Admission no</th>
                <th className="px-5 py-3.5 font-semibold">Class</th>
                <th className="px-5 py-3.5 font-semibold">Attendance</th>
                <th className="px-5 py-3.5 font-semibold">Performance</th>
                <th className="px-5 py-3.5 font-semibold">Classification</th>
                <th className="px-5 py-3.5 font-semibold">Fee balance</th>
                <th className="px-5 py-3.5 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {sortedRows.map((row) => (
                <tr className="table-row" key={row.id}>
                  <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.fullName}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.admissionNumber}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{row.class.name}-{row.class.section}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{percent(row.attendancePercentage)}</td>
                  <td className="px-5 py-4 text-[#5A6573]">{percent(row.performanceRate)}</td>
                  <td className="px-5 py-4"><StatusPill label={row.performanceClassification ?? "Not available"} tone={performanceTone(row.performanceClassification)} /></td>
                  <td className="px-5 py-4 text-[#5A6573]">{formatINR(row.pendingAmount ?? row.feeBalance ?? 0)}</td>
                  <td className="px-5 py-4">
                    <Link className="text-[13px] font-semibold text-[#2456E6] hover:text-[#1B45BD]" href={`/students/${row.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        ) : null}
      </ReportTable>
    </div>
  );
}
