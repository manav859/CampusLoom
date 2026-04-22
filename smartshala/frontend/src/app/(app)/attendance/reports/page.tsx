"use client";

import { useEffect, useMemo, useState } from "react";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";
import { attendanceApi, classesApi, type AttendanceDashboard } from "@/lib/api";

type ClassAttendanceRow = {
  classId: string;
  className: string;
  total: number;
  present: number;
  absent: number;
  attendancePercentage: number | null;
  marked: boolean;
};

export default function AttendanceReportsPage() {
  const [data, setData] = useState<AttendanceDashboard | null>(null);
  const [classRows, setClassRows] = useState<ClassAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const [dashboard, classes] = await Promise.all([attendanceApi.dashboard(), classesApi.list()]);
        const attendanceByClass = await Promise.all(
          classes.map(async (classItem) => {
            const today = await attendanceApi.classToday(classItem.id);
            const total = today.marked ? today.summary.total : classItem._count?.students ?? 0;
            const present = today.marked ? today.summary.present + today.summary.late : 0;
            const absent = today.marked ? today.summary.absent : 0;

            return {
              classId: classItem.id,
              className: `${classItem.name}-${classItem.section}`,
              total,
              present,
              absent,
              attendancePercentage: today.marked ? (total > 0 ? Math.round((present / total) * 100) : 0) : null,
              marked: today.marked
            };
          })
        );

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
        value: row.attendancePercentage ?? 0
      })),
    [classRows]
  );

  const alerts = useMemo(() => classRows.filter((row) => !row.marked), [classRows]);

  if (loading) {
    return <div className="rounded-lg border border-line bg-panel p-6 text-sm font-medium text-neutral-600">Loading attendance reports...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reports" title="Daily attendance report" />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="text-sm text-neutral-600">Total classes</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{data?.totalClasses ?? 0}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Marked</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-950">{data?.markedClasses ?? 0}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">Pending</p>
          <p className="mt-2 text-2xl font-semibold text-amber-950">{data?.pendingClasses ?? 0}</p>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="text-sm text-neutral-600">Attendance</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{data?.attendancePercentage ?? 0}%</p>
        </div>
      </div>

      <AttendanceSummary total={totals.total} present={totals.present} absent={totals.absent} />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-line bg-panel p-4">
          {chartItems.length > 0 ? <SimpleBarChart items={chartItems} /> : <p className="text-sm text-neutral-600">No classes available.</p>}
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-3">Class</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Present</th>
                <th className="px-3 py-3">Absent</th>
                <th className="px-3 py-3">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {classRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-neutral-600" colSpan={5}>
                    No classes available.
                  </td>
                </tr>
              ) : (
                classRows.map((row) => (
                  <tr key={row.classId}>
                    <td className="px-3 py-3 font-medium text-ink">{row.className}</td>
                    <td className="px-3 py-3">{row.total}</td>
                    <td className="px-3 py-3">{row.marked ? row.present : <StatusPill label="Pending" tone="warn" />}</td>
                    <td className="px-3 py-3">{row.marked ? row.absent : "-"}</td>
                    <td className="px-3 py-3">
                      {row.attendancePercentage === null ? <StatusPill label="Pending" tone="warn" /> : `${row.attendancePercentage}%`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="font-semibold text-ink">Pending alerts</h2>
        <div className="mt-3 space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-neutral-600">All classes have submitted attendance.</p>
          ) : (
            alerts.map((row) => (
              <div key={row.classId} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="font-medium text-amber-950">{row.className}</span>
                <StatusPill label="Missing" tone="warn" />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
