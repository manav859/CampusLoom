"use client";

import { useEffect, useState } from "react";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { FeeOverviewChart } from "@/components/dashboard/FeeOverviewChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCardSkeleton, ChartSkeleton, AlertSkeleton } from "@/components/ui/Skeleton";
import { apiFetch, feesApi, whatsappApi, type FeeDefaulter, type FeesDashboard, type NotificationLog } from "@/lib/api";

type DashboardResponse = {
  role: "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";
  kpis: Record<string, number>;
  attendance?: { className: string; attendancePercentage: number; marked: boolean; absent: number }[];
  alerts?: { studentName?: string; message?: string; severity?: string; flags?: string[] }[];
  aiSummary?: string;
};

export function DashboardHome({ mode }: { mode: "ADMIN" | "TEACHER" }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [fees, setFees] = useState<FeesDashboard | null>(null);
  const [defaulters, setDefaulters] = useState<FeeDefaulter[]>([]);
  const [waLogs, setWaLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      const [dashboardResult, feesResult, defaultersResult, logsResult] = await Promise.allSettled([
        apiFetch<DashboardResponse>("/dashboard"),
        mode === "ADMIN" ? feesApi.dashboard() : Promise.resolve(null),
        mode === "ADMIN" ? feesApi.defaulters() : Promise.resolve([]),
        mode === "ADMIN" ? whatsappApi.logs() : Promise.resolve([])
      ]);

      if (!active) return;

      if (dashboardResult.status === "fulfilled") {
        setData(dashboardResult.value);
      } else {
        setError(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "Dashboard data unavailable");
      }

      if (feesResult.status === "fulfilled") setFees(feesResult.value);
      if (defaultersResult.status === "fulfilled") setDefaulters(defaultersResult.value);
      if (logsResult.status === "fulfilled") setWaLogs(logsResult.value);
      setLoading(false);
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [mode]);

  /* ── KPI row ── */
  const adminKpis = data ? [
    { label: "Students", value: data.kpis.totalStudents ?? data.kpis.assignedStudents ?? 0, tone: "teal" as const },
    { label: "Attendance", value: `${data.kpis.todayAttendancePercentage ?? 0}%`, tone: "green" as const },
    { label: "Defaulters", value: defaulters.length || data.kpis.overdueInstallments || 0, tone: "red" as const },
    { label: "Collected", value: mode === "ADMIN" ? `₹${Number((fees?.totalCollected ?? 0) / 100000).toFixed(1)}L` : "Class view", tone: "amber" as const },
    { label: "AI Alerts", value: data.alerts?.length || 0, tone: "purple" as const }
  ] : [];

  /* ── Alert items ── */
  const actionAlerts = data ? [
    ...defaulters.slice(0, 2).map((item) => ({
      label: `${item.name} has ₹${item.balance.toLocaleString("en-IN")} pending`,
      detail: `${item.class} - ${item.daysOverdue} days overdue`,
      tone: item.daysOverdue > 0 ? "danger" as const : "warn" as const,
      href: `/fees/${item.studentId}`
    })),
    ...(data.alerts ?? []).slice(0, 3).map((alert) => ({
      label: alert.studentName ?? alert.message ?? "Attendance action needed",
      detail: alert.flags?.join(", ") ?? alert.severity ?? undefined,
      tone: alert.severity === "HIGH" ? "danger" as const : "warn" as const
    })),
    ...(data.attendance ?? [])
      .filter((item) => item.marked && item.attendancePercentage < 75)
      .slice(0, 2)
      .map((item) => ({
        label: `${item.className} low attendance`,
        detail: `${item.attendancePercentage}% attendance today`,
        tone: "warn" as const,
        href: "/attendance/reports"
      }))
  ].slice(0, 6) : [];

  /* ── Fee chart segments ── */
  const totalCollected = Number(fees?.totalCollected ?? 65);
  const totalPending = Number(fees?.totalPending ?? 25);
  const totalOverdue = defaulters.length > 0 ? 10 : 10;
  const feeSegments = [
    { label: "Collected", value: totalCollected, color: "#34c759" },
    { label: "Pending", value: totalPending, color: "#ff9500" },
    { label: "Overdue", value: totalOverdue, color: "#ff3b30" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={mode === "ADMIN" ? "Principal dashboard" : "Teacher dashboard"}
      />

      {error ? <div className="rounded-xl bg-[#ff9500]/10 px-4 py-3 text-[13px] font-medium text-[#c93400]">{error}</div> : null}

      {/* ═══ Row 1 — KPI Summary Cards ═══ */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          adminKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)
        )}
      </div>

      {/* ═══ Row 2 — Charts Row ═══ */}
      <section className="grid gap-4 xl:grid-cols-[3fr_2fr]" style={{ minHeight: 280 }}>
        {loading ? (
          <>
            <ChartSkeleton height={280} />
            <ChartSkeleton height={280} />
          </>
        ) : (
          <>
            <AttendanceChart
              data={(data?.attendance ?? []).filter((a) => a.marked).map((a) => ({ label: a.className, value: a.attendancePercentage }))}
              title="Attendance trend"
              classes={(data?.attendance ?? []).map((a) => a.className)}
            />
            <FeeOverviewChart segments={feeSegments} title="Fee overview" />
          </>
        )}
      </section>

      {/* ═══ Row 3 — Bottom ═══ */}
      <section className="grid gap-4 xl:grid-cols-[55fr_45fr]">
        {loading ? (
          <>
            <AlertSkeleton rows={4} />
            <AlertSkeleton rows={3} />
          </>
        ) : (
          <>
            <AlertPanel alerts={actionAlerts} loading={false} />
            <ActivityFeed />
          </>
        )}
      </section>
    </div>
  );
}
