"use client";

import { useEffect, useMemo, useState } from "react";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { attendanceApi, type AttendanceDashboard, type ClassesTodayReportRow } from "@/lib/api";

export default function AttendanceReportsPage() {
  const [data, setData] = useState<AttendanceDashboard | null>(null);
  const [classRows, setClassRows] = useState<ClassesTodayReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const [dashboard, attendanceByClass] = await Promise.all([attendanceApi.dashboard(), attendanceApi.classesTodayReport()]);

        if (cancelled) return;
        setData(dashboard);
        setClassRows(attendanceByClass);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load attendance reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReports();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(
    () => ({
      total: data ? data.students.present + data.students.absent : 0,
      present: data?.students.present ?? 0,
      absent: data?.students.absent ?? 0
    }),
    [data]
  );

  const chartItems = useMemo(
    () =>
      classRows.map((row) => ({
        label: row.className,
        value: row.percentage
      })),
    [classRows]
  );

  const alerts = useMemo(() => data?.alerts ?? [], [data]);
  const pendingClassIds = useMemo(() => new Set(alerts.map((alert) => alert.classId)), [alerts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Reports" title="Daily attendance report" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <ChartSkeleton height={250} />
          <TableSkeleton rows={4} cols={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reports" title="Daily attendance report" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card-interactive p-5">
          <p className="text-[13px] font-medium text-[#86868b]">Total classes</p>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{data?.totalClasses ?? 0}</p>
        </div>
        <div className="glass-card-interactive p-5">
          <p className="text-[13px] font-medium text-[#248a3d]">Marked</p>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{data?.markedClasses ?? 0}</p>
        </div>
        <div className="glass-card-interactive p-5">
          <p className="text-[13px] font-medium text-[#c93400]">Pending</p>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{data?.pendingClasses ?? 0}</p>
        </div>
        <div className="glass-card-interactive p-5">
          <p className="text-[13px] font-medium text-[#86868b]">Attendance</p>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">{data?.attendancePercentage ?? 0}%</p>
        </div>
      </div>

      <AttendanceSummary total={totals.total} present={totals.present} absent={totals.absent} />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Class-wise trend</h2>
          <div className="mt-5">
            {chartItems.length > 0 ? <SimpleBarChart items={chartItems} /> : <p className="text-[13px] text-[#86868b]">No classes available.</p>}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Class</th>
                  <th className="px-5 py-3.5 font-semibold">Total</th>
                  <th className="px-5 py-3.5 font-semibold">Present</th>
                  <th className="px-5 py-3.5 font-semibold">Absent</th>
                  <th className="px-5 py-3.5 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {classRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={5}>
                      No classes available.
                    </td>
                  </tr>
                ) : (
                  classRows.map((row) => (
                    <tr className="table-row" key={row.classId}>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.className}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{row.total}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{pendingClassIds.has(row.classId) ? <StatusPill label="Pending" tone="warn" /> : row.present}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{pendingClassIds.has(row.classId) ? "—" : row.absent}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">
                        {pendingClassIds.has(row.classId) ? <StatusPill label="Pending" tone="warn" /> : `${row.percentage}%`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="glass-card-interactive p-6">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Pending alerts</h2>
        <div className="mt-4 space-y-2">
          {alerts.length === 0 ? (
            <p className="text-[13px] text-[#86868b]">All classes have submitted attendance.</p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.classId} className="flex items-center justify-between gap-3 rounded-xl bg-[#ff9500]/[0.05] px-4 py-3">
                <span className="font-medium text-[#1d1d1f] text-[13px]">{alert.className}</span>
                <StatusPill label="Missing" tone="warn" />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
