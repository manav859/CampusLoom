"use client";

import { useEffect, useState } from "react";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { WhatsAppWidget } from "@/components/dashboard/WhatsAppWidget";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { apiFetch, feesApi, whatsappApi, type FeeDefaulter, type FeesDashboard, type NotificationLog } from "@/lib/api";

type DashboardResponse = {
  role: "PRINCIPAL" | "ADMIN" | "TEACHER";
  kpis: Record<string, number>;
  attendance?: { className: string; attendancePercentage: number; marked: boolean; absent: number }[];
  alerts?: { studentName?: string; message?: string; severity?: string; flags?: string[] }[];
  aiSummary?: string;
};

const fallbackAdmin: DashboardResponse = {
  role: "ADMIN",
  kpis: {
    totalStudents: 30,
    totalClasses: 3,
    todayAttendancePercentage: 86,
    classesMarked: 2,
    classesPending: 1,
    absentToday: 6,
    totalFeesPending: 540000,
    overdueInstallments: 12
  },
  attendance: [
    { className: "6-A", attendancePercentage: 91, marked: true, absent: 2 },
    { className: "7-A", attendancePercentage: 84, marked: true, absent: 4 },
    { className: "8-B", attendancePercentage: 0, marked: false, absent: 0 }
  ],
  alerts: [
    { studentName: "Aarav Patel", severity: "HIGH", flags: ["LOW_ATTENDANCE", "FEE_PENDING"] },
    { studentName: "Riya Patel", severity: "MEDIUM", flags: ["REPEAT_ABSENTEE"] }
  ],
  aiSummary: "2 students need priority follow-up for both low attendance and pending fees."
};

export function DashboardHome({ mode }: { mode: "ADMIN" | "TEACHER" }) {
  const [data, setData] = useState<DashboardResponse>(fallbackAdmin);
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
        setData(fallbackAdmin);
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

  const adminKpis = [
    { label: "Total students", value: data.kpis.totalStudents ?? data.kpis.assignedStudents ?? 0 },
    { label: "Attendance %", value: `${data.kpis.todayAttendancePercentage ?? 0}%`, tone: "good" as const },
    { label: "Fees collected", value: mode === "ADMIN" ? `Rs ${Number(fees?.totalCollected ?? 0).toLocaleString("en-IN")}` : "Class view", tone: "good" as const },
    { label: "Defaulters", value: defaulters.length || data.kpis.overdueInstallments || 0, tone: "danger" as const }
  ];

  const actionAlerts = [
    ...defaulters.slice(0, 2).map((item) => ({
      label: `${item.name} has Rs ${item.balance.toLocaleString("en-IN")} pending`,
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
  ].slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={mode === "ADMIN" ? "Principal dashboard" : "Teacher dashboard"}
        title={mode === "ADMIN" ? "Daily action board" : "Today's class work"}
        action={<a className="btn-primary" href="/attendance">Mark attendance</a>}
      />

      {error ? <div className="rounded-xl bg-[#ff9500]/10 px-4 py-3 text-[13px] font-medium text-[#c93400]">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {adminKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card-interactive p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Overview</p>
          <h2 className="mt-1.5 text-[17px] font-semibold text-[#000000]">Class attendance today</h2>
          <div className="mt-5">
            <SimpleBarChart items={(data.attendance ?? []).map((item) => ({ label: item.className, value: item.attendancePercentage }))} />
          </div>
        </div>

        <WhatsAppWidget logs={waLogs} loading={loading} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AlertPanel alerts={actionAlerts} loading={loading} />
        <div className="glass-card-interactive p-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#86868b]">Summary</p>
          <h2 className="mt-1.5 text-[17px] font-bold text-[#000000]">Daily summary</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#000000]">{data.aiSummary ?? "No critical risk detected yet today."}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[rgba(0,0,0,0.04)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Marked</p>
              <p className="mt-2 text-[24px] font-bold tracking-tight text-[#000000]">{data.kpis.classesMarked ?? 0}</p>
            </div>
            <div className="rounded-xl bg-[#ff9500]/[0.08] p-4 border border-[#ff9500]/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#c93400]">Pending</p>
              <p className="mt-2 text-[24px] font-bold tracking-tight text-[#000000]">{data.kpis.classesPending ?? data.kpis.pendingAttendance ?? 0}</p>
            </div>
            <div className="rounded-xl bg-[#ff3b30]/[0.08] p-4 border border-[#ff3b30]/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#d70015]">Absent</p>
              <p className="mt-2 text-[24px] font-bold tracking-tight text-[#000000]">{data.kpis.absentToday ?? 0}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
