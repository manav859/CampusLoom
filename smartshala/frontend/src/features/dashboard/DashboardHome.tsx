"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { FeeOverviewChart } from "@/components/dashboard/FeeOverviewChart";
import { ActivityFeed, type ActivityEvent } from "@/components/dashboard/ActivityFeed";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCardSkeleton, ChartSkeleton, AlertSkeleton } from "@/components/ui/Skeleton";
import { apiFetch, studentsApi, whatsappApi, type FeeDefaulter, type FeesDashboard, type NotificationLog } from "@/lib/api";
import { formatINR } from "@/lib/formatters";
import { cachedFetch, getCachedData } from "@/lib/prefetchCache";

type DashboardResponse = {
  role: "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";
  kpis: Record<string, number>;
  attendance?: {
    absent: number;
    attended?: number;
    attendancePercentage: number;
    className: string;
    halfDay?: number;
    marked: boolean;
    present?: number;
    totalStudents?: number;
  }[];
  alerts?: { type?: string; studentId?: string; studentName?: string; message?: string; severity?: string; flags?: string[] }[];
  aiSummary?: string;
  defaulters?: FeeDefaulter[];
  feeSummary?: FeesDashboard;
};

function relativeTime(value?: string | Date | null) {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function notificationType(kind: NotificationLog["kind"]): ActivityEvent["type"] {
  if (kind === "PAYMENT_RECEIPT") return "fee";
  if (kind === "ABSENCE" || kind === "LOW_ATTENDANCE") return "attendance";
  if (kind === "FEE_REMINDER" || kind === "OVERDUE_FEE") return "alert";
  return "message";
}

function buildActivityEvents(data: DashboardResponse | null, logs: NotificationLog[]): ActivityEvent[] {
  const notificationEvents = logs.slice(0, 8).map((log) => ({
    id: `notification-${log.id}`,
    text: log.student?.fullName ? `${log.student.fullName}: ${log.message}` : log.message,
    time: relativeTime(log.sentAt ?? log.createdAt),
    type: notificationType(log.kind)
  }));

  const alertEvents = (data?.alerts ?? []).slice(0, 4).map((alert, index) => ({
    id: `alert-${alert.studentId ?? index}`,
    text: alert.studentName && alert.message ? `${alert.studentName}: ${alert.message}` : alert.message ?? "Dashboard alert",
    time: "Current",
    type: "alert" as const
  }));

  const attendanceEvents = (data?.attendance ?? [])
    .filter((item) => item.marked)
    .slice(0, 4)
    .map((item) => ({
      id: `attendance-${item.className}`,
      text: `${item.className} attendance marked (${item.attendancePercentage}%)`,
      time: "Today",
      type: item.attendancePercentage < 75 ? "alert" as const : "attendance" as const
    }));

  const feeEvents = (data?.defaulters ?? []).slice(0, 3).map((item) => ({
    id: `fee-${item.studentId}`,
    text: `${item.name} has ${formatINR(item.balance, { compact: false })} pending`,
    time: item.daysOverdue > 0 ? `${item.daysOverdue} days overdue` : "Pending",
    type: "fee" as const
  }));

  return [...notificationEvents, ...alertEvents, ...attendanceEvents, ...feeEvents].slice(0, 8);
}

export function DashboardHome({ mode }: { mode: "ADMIN" | "TEACHER" }) {
  const dashboardCacheKey = mode === "ADMIN" ? "dashboard" : "dashboard:teacher";
  const cachedDashboard = getCachedData<DashboardResponse>(dashboardCacheKey);
  const [data, setData] = useState<DashboardResponse | null>(cachedDashboard);
  const [fees, setFees] = useState<FeesDashboard | null>(cachedDashboard?.feeSummary ?? null);
  const [defaulters, setDefaulters] = useState<FeeDefaulter[]>(cachedDashboard?.defaulters ?? []);
  const [loading, setLoading] = useState(!cachedDashboard);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sendingReminderId, setSendingReminderId] = useState("");
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(!getCachedData<DashboardResponse>(dashboardCacheKey));
      setError("");
      const dashboardResult = await cachedFetch(dashboardCacheKey, () => apiFetch<DashboardResponse>("/dashboard"))
        .then((value) => ({ status: "fulfilled" as const, value }))
        .catch((reason) => ({ status: "rejected" as const, reason }));

      if (!active) return;

      if (dashboardResult.status === "fulfilled") {
        setData(dashboardResult.value);
        setFees(dashboardResult.value.feeSummary ?? null);
        setDefaulters(dashboardResult.value.defaulters ?? []);
      } else {
        setData({ role: mode === "ADMIN" ? "ADMIN" : "TEACHER", kpis: {}, attendance: [], alerts: [] });
        setFees(null);
        setDefaulters([]);
        setError("Dashboard metrics are refreshing. Showing available cards.");
      }
      setLoading(false);
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [dashboardCacheKey, mode]);

  useEffect(() => {
    let active = true;

    cachedFetch("notifications:logs", () => whatsappApi.logs())
      .then((logs) => {
        if (active) setNotificationLogs(logs);
      })
      .catch(() => {
        if (active) setNotificationLogs([]);
      });

    return () => {
      active = false;
    };
  }, []);

  /* ── KPI row ── */
  const kpis = data?.kpis ?? {};
  const totalClasses = kpis.totalClasses ?? kpis.assignedClasses ?? 0;
  const markedClasses = kpis.classesMarked ?? 0;
  const pendingClasses = kpis.classesPending ?? kpis.pendingAttendance ?? 0;
  const defaulterCount = fees?.defaulterCount ?? defaulters.length ?? kpis.overdueInstallments ?? 0;
  const teacherPendingHomework = kpis.pendingHomeworkSubmissions ?? data?.alerts?.filter((alert) => alert.type === "HOMEWORK_PENDING").length ?? 0;
  const markedTodayPercentage = totalClasses ? Math.round((markedClasses / totalClasses) * 100) : 0;
  const pulseText = mode === "ADMIN"
    ? `${markedClasses} of ${totalClasses} classes marked today, ${defaulterCount} fee follow-ups pending.`
    : `${pendingClasses} attendance actions and ${teacherPendingHomework} homework submissions pending for your students.`;

  const adminKpis = [
    {
      label: mode === "ADMIN" ? "Students" : "Your students",
      value: kpis.totalStudents ?? kpis.assignedStudents ?? 0,
      formula: mode === "ADMIN" ? "Active students in the school." : "Active students in classes assigned to you.",
      href: "/students",
      tone: "teal" as const
    },
    mode === "ADMIN"
      ? {
          label: "Marked today",
          value: `${markedTodayPercentage}%`,
          helper: `${markedClasses} of ${totalClasses} classes marked`,
          formula: "Classes marked today / total active classes.",
          href: "/attendance/reports",
          tone: pendingClasses > 0 ? "amber" as const : "green" as const
        }
      : {
          label: "Pending attendance",
          value: pendingClasses,
          helper: "Your classes today",
          formula: "Assigned classes without today's attendance submitted.",
          href: "/attendance",
          tone: pendingClasses > 0 ? "amber" as const : "green" as const
        },
    mode === "ADMIN"
      ? {
          label: "Defaulters",
          value: defaulterCount,
          helper: "School-wide",
          formula: "Students with pending or overdue fee balance.",
          href: "/fees/defaulters",
          tone: "red" as const
        }
      : {
          label: "Pending homework",
          value: teacherPendingHomework,
          helper: "Your students",
          formula: "Not submitted homework across classes assigned to you.",
          href: "/teacher/homework",
          tone: teacherPendingHomework > 0 ? "amber" as const : "green" as const
        },
    {
      label: "Collected",
      value: mode === "ADMIN" ? formatINR(fees?.totalCollected ?? 0) : "Class view",
      formula: mode === "ADMIN" ? "Total fee payments received for active fee assignments." : "Fee totals are hidden in teacher view.",
      href: mode === "ADMIN" ? "/fees" : "/teacher/classes",
      tone: "amber" as const
    },
    {
      label: "AI Alerts",
      value: data?.alerts?.length || 0,
      helper: "Opens risk insights",
      formula: "Open risk and behaviour signals from dashboard analytics.",
      href: "/analytics",
      tone: "purple" as const
    }
  ];

  /* ── Alert items ── */
  async function sendFeeReminder(item: FeeDefaulter) {
    setSendingReminderId(item.studentId);
    setNotice("");
    setError("");
    try {
      const student = await studentsApi.get(item.studentId);
      await whatsappApi.send({
        phone: student.parentPhone,
        message: `Dear Parent, fee balance of ${formatINR(item.balance, { compact: false })} for ${item.name} is pending. Please clear it at the earliest.`
      });
      setNotice(`WhatsApp reminder sent to ${item.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send fee reminder");
    } finally {
      setSendingReminderId("");
    }
  }

  const actionAlerts = data ? [
    ...defaulters.slice(0, 2).map((item) => ({
      actionLabel: sendingReminderId === item.studentId ? "Sending..." : "Send reminder",
      disabled: sendingReminderId === item.studentId,
      label: `${item.name} has ${formatINR(item.balance, { compact: false })} pending`,
      detail: `${item.class} - ${item.daysOverdue} days overdue`,
      onAction: () => sendFeeReminder(item),
      severity: item.daysOverdue >= 30 ? "critical" as const : item.daysOverdue > 0 ? "high" as const : "medium" as const,
      tone: item.daysOverdue > 0 ? "danger" as const : "warn" as const,
      href: `/fees/${item.studentId}`
    })),
    ...(data.alerts ?? []).slice(0, 3).map((alert) => ({
      label:
        alert.type === "BEHAVIOUR_INCIDENT" && alert.studentName && alert.message
          ? `${alert.studentName}: ${alert.message}`
          : alert.studentName ?? alert.message ?? "Attendance action needed",
      detail: alert.flags?.join(", ") ?? alert.severity ?? undefined,
      severity: alert.severity === "HIGH" ? "critical" as const : alert.severity === "MEDIUM" ? "high" as const : "medium" as const,
      tone: alert.severity === "HIGH" ? "danger" as const : "warn" as const,
      href: alert.studentId ? `/students/${alert.studentId}` : undefined
    })),
    ...(data.attendance ?? [])
      .filter((item) => item.marked && item.attendancePercentage < 75)
      .slice(0, 2)
      .map((item) => ({
        label: `${item.className} low attendance`,
        detail: `${item.attendancePercentage}% attendance today`,
        severity: item.attendancePercentage < 60 ? "critical" as const : "high" as const,
        tone: "warn" as const,
        href: "/attendance/reports"
      }))
  ].slice(0, 6) : [];

  /* ── Fee chart segments ── */
  const totalCollected = Number(fees?.totalCollected ?? 0);
  const totalPending = Number(fees?.totalPending ?? 0);
  const totalOverdue = Math.min(Number(fees?.totalOverdue ?? 0), totalPending);
  const currentPending = Math.max(totalPending - totalOverdue, 0);
  const feeSegments = [
    { label: "Collected", value: totalCollected, color: "#34c759" },
    { label: "Pending", value: currentPending, color: "#ff9500" },
    { label: "Overdue", value: totalOverdue, color: "#ff3b30" },
  ];
  const teacherWorkSegments = [
    { label: "Marked", value: markedClasses, color: "#34c759" },
    { label: "Unmarked", value: pendingClasses, color: "#ff9500" },
    { label: "Homework", value: teacherPendingHomework, color: "#7c3aed" }
  ];
  const activityEvents = buildActivityEvents(data, notificationLogs);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={mode === "ADMIN" ? "Principal dashboard" : "Teacher dashboard"}
      />
      <p className="text-[14px] font-medium leading-6 text-[#5A6573]">{pulseText}</p>

      {error ? <div className="rounded-xl bg-[#ff9500]/10 px-4 py-3 text-[13px] font-medium text-[#c93400]">{error}</div> : null}
      {notice ? (
        <div className="flex items-center justify-between rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">
          <span>{notice}</span>
          <button className="font-semibold underline-offset-2 hover:underline" onClick={() => setNotice("")} type="button">Dismiss</button>
        </div>
      ) : null}

      {mode === "ADMIN" ? (
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg bg-[#2456E6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1B45BD]" href="/attendance">Mark today&apos;s attendance</Link>
          <Link className="rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href="/fees/defaulters">Send fee reminder</Link>
          <Link className="rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href="/students/new">Add student</Link>
          <Link className="rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href="/fees/new">Record payment</Link>
        </div>
      ) : null}

      {/* ═══ Row 1 — KPI Summary Cards ═══ */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          adminKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)
        )}
      </div>

      {/* ═══ Row 2 — Charts Row ═══ */}
      <section className="dashboard-charts-grid grid gap-4" style={{ minHeight: 280 }}>
        {loading ? (
          <>
            <ChartSkeleton height={280} />
            <ChartSkeleton height={280} />
          </>
        ) : (
          <>
            <AttendanceChart
              data={(data?.attendance ?? []).map((a) => ({
                absent: a.absent,
                attended: a.attended,
                halfDay: a.halfDay,
                label: a.className,
                marked: a.marked,
                present: a.present,
                total: a.totalStudents,
                value: a.attendancePercentage
              }))}
              title={mode === "ADMIN" ? "Attendance in marked classes" : "Your class attendance"}
              classes={(data?.attendance ?? []).map((a) => a.className)}
            />
            <FeeOverviewChart
              eyebrow={mode === "ADMIN" ? "Finance" : "Teacher workload"}
              segments={mode === "ADMIN" ? feeSegments : teacherWorkSegments}
              title={mode === "ADMIN" ? "Fee overview - active assignments" : "Today's actions"}
            />
          </>
        )}
      </section>

      {/* ═══ Row 3 — Bottom ═══ */}
      <section className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <>
            <AlertSkeleton rows={4} />
            <AlertSkeleton rows={3} />
          </>
        ) : (
          <>
            <AlertPanel alerts={actionAlerts} loading={false} />
            <ActivityFeed events={activityEvents} />
          </>
        )}
      </section>
    </div>
  );
}
