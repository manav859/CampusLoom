"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import { KpiCardSkeleton, StatCardSkeleton, AlertSkeleton } from "@/components/ui/Skeleton";
import { attendanceApi, type AttendanceDashboard } from "@/lib/api";

export default function PrincipalAttendanceDashboardPage() {
  const [data, setData] = useState<AttendanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const result = await attendanceApi.dashboard();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load attendance dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <header>
          <p className="text-sm font-semibold text-action">Attendance dashboard</p>
          <h1 className="text-2xl font-bold text-ink">Today at a glance</h1>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <section className="grid gap-3 sm:grid-cols-2">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </section>
        <AlertSkeleton rows={3} />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>;
  }

  if (!data) {
    return <div className="rounded-lg border border-line bg-panel p-6 text-sm text-neutral-600">No attendance data available.</div>;
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold text-action">Attendance dashboard</p>
        <h1 className="text-2xl font-bold text-ink">Today at a glance</h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total classes" value={data.totalClasses} />
        <KpiCard label="Marked" value={data.markedClasses} tone="good" />
        <KpiCard label="Pending" value={data.pendingClasses} tone={data.pendingClasses > 0 ? "warn" : "good"} />
        <KpiCard label="Attendance" value={`${data.attendancePercentage}%`} tone="good" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-700">Students present</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">{data.students.present}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">Students absent</p>
          <p className="mt-2 text-3xl font-bold text-red-900">{data.students.absent}</p>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="font-semibold text-ink">Pending classes</h2>
        <div className="mt-3 space-y-2">
          {data.alerts.length === 0 ? (
            <p className="text-sm text-neutral-600">All classes have submitted attendance.</p>
          ) : (
            data.alerts.map((alert) => (
              <div key={alert.classId} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="font-medium text-amber-950">{alert.className}</span>
                <span className="text-xs font-bold uppercase text-amber-700">Missing</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
