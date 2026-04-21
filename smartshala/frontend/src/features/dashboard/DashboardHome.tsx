"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch } from "@/lib/api";

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

  useEffect(() => {
    apiFetch<DashboardResponse>("/dashboard")
      .then(setData)
      .catch(() => setData(fallbackAdmin));
  }, []);

  const adminKpis = [
    { label: "Students", value: data.kpis.totalStudents ?? data.kpis.assignedStudents ?? 0 },
    { label: mode === "ADMIN" ? "Classes" : "Assigned classes", value: data.kpis.totalClasses ?? data.kpis.assignedClasses ?? 0 },
    { label: "Today attendance", value: `${data.kpis.todayAttendancePercentage ?? 0}%`, tone: "good" as const },
    { label: "Pending attendance", value: data.kpis.classesPending ?? data.kpis.pendingAttendance ?? 0, tone: "warn" as const },
    { label: "Absent today", value: data.kpis.absentToday ?? 0, tone: "danger" as const },
    { label: "Fees pending", value: mode === "ADMIN" ? `Rs ${Number(data.kpis.totalFeesPending ?? 0).toLocaleString("en-IN")}` : "Class view", tone: "warn" as const }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={mode === "ADMIN" ? "Principal dashboard" : "Teacher dashboard"}
        title={mode === "ADMIN" ? "Daily action board" : "Today's class work"}
        action={<a className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white" href="/attendance/mark">Mark attendance</a>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {adminKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
          <h2 className="font-semibold text-ink">Class attendance today</h2>
          <div className="mt-4">
            <SimpleBarChart items={(data.attendance ?? []).map((item) => ({ label: item.className, value: item.attendancePercentage }))} />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
          <h2 className="font-semibold text-ink">AI daily note</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-700">{data.aiSummary ?? "No critical risk detected yet today."}</p>
          <div className="mt-4 space-y-2">
            {(data.alerts ?? []).slice(0, 4).map((alert, index) => (
              <div key={`${alert.studentName}-${index}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                <span className="text-sm text-neutral-700">{alert.studentName ?? alert.message}</span>
                <StatusPill label={alert.severity ?? "Info"} tone={alert.severity === "HIGH" ? "danger" : "warn"} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
