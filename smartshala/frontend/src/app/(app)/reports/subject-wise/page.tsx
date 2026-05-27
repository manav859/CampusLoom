"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { marksApi, type MarksExam } from "@/lib/api";
import { downloadCsv, percent, ReportTable } from "@/features/reports/reportUtils";

type SubjectReportRow = {
  subject: string;
  classes: Set<string>;
  exams: number;
  entered: number;
  pending: number;
  averageSum: number;
};

function statusFor(avg: number) {
  if (avg >= 85) return { label: "Excellent", tone: "good" as const };
  if (avg >= 70) return { label: "Good", tone: "good" as const };
  if (avg >= 50) return { label: "Needs Attention", tone: "warn" as const };
  return { label: "At Risk", tone: "danger" as const };
}

export default function SubjectWiseReportPage() {
  const [exams, setExams] = useState<MarksExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await marksApi.exams();
        if (active) setExams(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load subject wise report");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const map = new Map<string, SubjectReportRow>();
    for (const exam of exams) {
      const current = map.get(exam.subject) ?? {
        subject: exam.subject,
        classes: new Set<string>(),
        exams: 0,
        entered: 0,
        pending: 0,
        averageSum: 0
      };
      current.classes.add(exam.className);
      current.exams += 1;
      current.entered += exam.enteredCount;
      current.pending += exam.pendingCount;
      current.averageSum += exam.classAverage;
      map.set(exam.subject, current);
    }
    return Array.from(map.values()).sort((a, b) => (b.averageSum / Math.max(1, b.exams)) - (a.averageSum / Math.max(1, a.exams)));
  }, [exams]);

  function exportCsv() {
    downloadCsv(`subject-wise-report-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Subject", "Classes", "Exams", "Entered", "Pending", "Average", "Status"],
      ...rows.map((row) => {
        const average = row.averageSum / Math.max(1, row.exams);
        return [row.subject, Array.from(row.classes).join("; "), row.exams, row.entered, row.pending, percent(average), statusFor(average).label];
      })
    ]);
  }

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Subject wise report"
        action={<button className="btn-primary min-h-10 px-4 text-[13px]" disabled={loading || rows.length === 0} onClick={exportCsv} type="button">Export CSV</button>}
      />
      <ReportTable colSpan={7} empty={loading ? "Loading subjects..." : "No marks available."} isEmpty={loading || rows.length === 0}>
        {!loading && rows.length > 0 ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Subject</th>
                <th className="px-5 py-3.5 font-semibold">Classes</th>
                <th className="px-5 py-3.5 font-semibold">Exams</th>
                <th className="px-5 py-3.5 font-semibold">Entered</th>
                <th className="px-5 py-3.5 font-semibold">Pending</th>
                <th className="px-5 py-3.5 font-semibold">Average</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {rows.map((row) => {
                const average = row.averageSum / Math.max(1, row.exams);
                const status = statusFor(average);
                return (
                  <tr className="table-row" key={row.subject}>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.subject}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{Array.from(row.classes).join(", ")}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.exams}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.entered}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.pending}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{percent(average)}</td>
                    <td className="px-5 py-4"><StatusPill label={status.label} tone={status.tone} /></td>
                  </tr>
                );
              })}
            </tbody>
          </>
        ) : null}
      </ReportTable>
    </div>
  );
}
