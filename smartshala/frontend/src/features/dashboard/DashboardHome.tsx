"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { FeeOverviewChart } from "@/components/dashboard/FeeOverviewChart";
import { ActivityFeed, type ActivityEvent } from "@/components/dashboard/ActivityFeed";
import { KpiCardSkeleton, ChartSkeleton, AlertSkeleton } from "@/components/ui/Skeleton";
import { activityApi, apiFetch, studentsApi, whatsappApi, type ActivityLog, type FeeDefaulter, type FeesDashboard } from "@/lib/api";
import { formatINR, humanizeConstant } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";
import type { Kpi } from "@/types";

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

type PaymentStudentItem = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  parentPhone?: string;
  isActive: boolean;
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

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function actionLabel(action: string) {
  if (action === "CREATE_OR_RUN") return "Create";
  if (action === "REPLACE") return "Update";
  return humanizeConstant(action);
}

function moduleLabel(entityType: string) {
  const label = humanizeConstant(entityType);
  if (label.toLowerCase() === "students") return "Student";
  if (label.toLowerCase() === "notifications") return "Notifications";
  return label;
}

function activityType(log: ActivityLog): ActivityEvent["type"] {
  if (log.entityType === "ATTENDANCE") return "attendance";
  if (log.entityType === "FEE" || log.entityType === "FEES") return "fee";
  if (log.entityType === "NOTIFICATIONS" || log.entityType === "WA" || log.entityType === "COMMUNICATION") return "message";
  if (log.action === "DELETE") return "alert";
  return "message";
}

function bodyOf(log: ActivityLog) {
  return (log.afterJson?.body ?? {}) as Record<string, unknown>;
}

function targetName(log: ActivityLog) {
  const before = (log.beforeJson ?? {}) as Record<string, unknown>;
  const after = (log.afterJson ?? {}) as Record<string, unknown>;
  const body = bodyOf(log);
  const candidates = [after.fullName, body.fullName, before.fullName, after.name, body.name, body.studentName, body.title];
  const value = candidates.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value : "";
}

function activityDescription(log: ActivityLog) {
  if (!log.summary.includes(" /") && !log.summary.includes(" PATCH ") && !log.summary.includes(" POST ") && !log.summary.includes(" PUT ") && !log.summary.includes(" DELETE ")) {
    return log.summary;
  }

  const target = targetName(log);
  const module = moduleLabel(log.entityType).toLowerCase();
  const action = actionLabel(log.action).toLowerCase();
  return `${action.charAt(0).toUpperCase() + action.slice(1)} ${module}${target ? ` ${target}` : ""}`;
}

function buildActivityEvents(logs: ActivityLog[]): ActivityEvent[] {
  return logs.slice(0, 12).map((log) => ({
    id: log.id,
    text: activityDescription(log),
    time: relativeTime(log.createdAt),
    type: activityType(log),
    details: [
      `Module: ${moduleLabel(log.entityType)}`,
      `Action: ${actionLabel(log.action)}`,
      `By: ${log.actor?.fullName ?? "System"}`
    ]
  }));
}

const dashboardKpiStyles = [
  { bg: "bg-[#F1E4FF]", icon: "text-[#A96BF4]" },
  { bg: "bg-[#E5F7FF]", icon: "text-[#67C3F4]" },
  { bg: "bg-[#FFF0E8]", icon: "text-[#FF9867]" },
  { bg: "bg-[#EAF9EB]", icon: "text-[#55C979]" },
  { bg: "bg-[#F0E8FF]", icon: "text-[#8B6CF6]" }
];

function DashboardKpiIcon({ label, className }: { label: string; className: string }) {
  const key = label.toLowerCase();

  if (key.includes("student")) {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
        <path d="m24 7 17 7-17 7-17-7 17-7Z" fill="currentColor" opacity=".95" />
        <path d="M13 18v8c0 5 4.9 9 11 9s11-4 11-9v-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        <path d="M9 16v10" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <path d="M16 39c2.2-4 5-6 8-6s5.8 2 8 6" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      </svg>
    );
  }

  if (key.includes("teacher") || key.includes("marked") || key.includes("attendance") || key.includes("class")) {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
        <circle cx="24" cy="13" r="7" fill="currentColor" />
        <path d="M12 40c1.2-10 6.2-15 12-15s10.8 5 12 15H12Z" fill="currentColor" opacity=".85" />
        <path d="m20 27 4 11 4-11" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      </svg>
    );
  }

  if (key.includes("parent") || key.includes("defaulter") || key.includes("homework")) {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
        <circle cx="24" cy="15" r="7" fill="currentColor" />
        <circle cx="12" cy="19" r="5" fill="currentColor" opacity=".85" />
        <circle cx="36" cy="19" r="5" fill="currentColor" opacity=".85" />
        <path d="M11 39c1-8 5.6-12 13-12s12 4 13 12" fill="currentColor" opacity=".95" />
        <path d="M4 38c.7-6 3.6-9 8.5-9 2.2 0 4 .6 5.4 1.8" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <path d="M30.1 30.8c1.4-1.2 3.2-1.8 5.4-1.8 4.9 0 7.8 3 8.5 9" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      </svg>
    );
  }

  if (key.includes("earning") || key.includes("collected") || key.includes("fee")) {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
        <path d="M16 13h16l-4 7h-8l-4-7Z" fill="currentColor" opacity=".85" />
        <path d="M11 38c0-10 5.8-18 13-18s13 8 13 18c0 3-2.3 5-5.2 5H16.2c-2.9 0-5.2-2-5.2-5Z" fill="currentColor" />
        <path d="M24 28v9M20.5 31c0-1.7 1.6-3 3.7-3 1.4 0 2.6.5 3.3 1.3M27.5 35.7c-.7.8-1.9 1.3-3.3 1.3-2.1 0-3.7-1.3-3.7-3" stroke="white" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 48 48">
      <path d="M24 7 43 40H5L24 7Z" fill="currentColor" opacity=".95" />
      <path d="M24 18v10M24 34h.01" stroke="white" strokeLinecap="round" strokeWidth="4" />
    </svg>
  );
}

function DashboardKpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const style = dashboardKpiStyles[index % dashboardKpiStyles.length];
  const content = (
    <div
      className={`relative flex h-[112px] items-center justify-between overflow-hidden rounded-[8px] px-5 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] transition-transform duration-200 hover:-translate-y-0.5 ${style.bg}`}
      title={kpi.formula}
    >
      <div className="min-w-0 pr-3">
        <p className="truncate text-[15px] font-medium leading-5 text-[#6F7480]">{kpi.label}</p>
        <p className="mt-2 truncate text-[27px] font-bold leading-8 tracking-normal text-[#111827] [font-variant-numeric:tabular-nums]">{kpi.value}</p>
      </div>
      <DashboardKpiIcon label={kpi.label} className={`h-12 w-12 shrink-0 sm:h-14 sm:w-14 ${style.icon}`} />
    </div>
  );

  if (!kpi.href) return content;

  return (
    <Link aria-label={`${kpi.label} details`} className="block rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#2456E6]/40 focus:ring-offset-2" href={kpi.href}>
      {content}
    </Link>
  );
}

export function DashboardHome({ mode }: { mode: "ADMIN" | "TEACHER" }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [fees, setFees] = useState<FeesDashboard | null>(null);
  const [defaulters, setDefaulters] = useState<FeeDefaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sendingReminderId, setSendingReminderId] = useState("");
  const [activityDate, setActivityDate] = useState(() => dateInputValue(new Date()));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStudents, setPaymentStudents] = useState<PaymentStudentItem[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      const dashboardResult = await apiFetch<DashboardResponse>("/dashboard")
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
  }, [mode]);

  useEffect(() => {
    let active = true;

    cachedFetch(`dashboard:activity:${activityDate}`, () => activityApi.logs({ dateFrom: activityDate, dateTo: activityDate, limit: 12, page: 1 }))
      .then((result) => {
        if (active) setActivityLogs(result.items);
      })
      .catch(() => {
        if (active) setActivityLogs([]);
      });

    return () => {
      active = false;
    };
  }, [activityDate]);

  useEffect(() => {
    if (!paymentModalOpen) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "8", page: "1" });
      const trimmed = paymentSearch.trim();
      if (trimmed) params.set("search", trimmed);

      setPaymentLoading(true);
      setPaymentError("");
      apiFetch<{ items: PaymentStudentItem[]; total: number }>(`/students?${params.toString()}`)
        .then((result) => {
          if (active) setPaymentStudents(result.items ?? []);
        })
        .catch((err) => {
          if (active) {
            setPaymentStudents([]);
            setPaymentError(err instanceof Error ? err.message : "Unable to search students");
          }
        })
        .finally(() => {
          if (active) setPaymentLoading(false);
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [paymentModalOpen, paymentSearch]);

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
      label: mode === "ADMIN" ? "Students" : "Assigned Students",
      value: kpis.totalStudents ?? kpis.assignedStudents ?? 0,
      formula: mode === "ADMIN" ? "Active students in the school." : "Active students in classes assigned to you.",
      href: "/students",
      tone: "teal" as const
    },
    mode === "ADMIN"
      ? {
          label: "Marked Today",
          value: `${markedTodayPercentage}%`,
          helper: `${markedClasses} of ${totalClasses} classes marked`,
          formula: "Classes marked today / total active classes.",
          href: "/reports/daily-attendance",
          tone: pendingClasses > 0 ? "amber" as const : "green" as const
        }
      : {
          label: "Pending Attendance",
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
          label: "Pending Homework",
          value: teacherPendingHomework,
          helper: "Your students",
          formula: "Not submitted homework across classes assigned to you.",
          href: "/teacher/homework",
          tone: teacherPendingHomework > 0 ? "amber" as const : "green" as const
        },
    mode === "ADMIN"
      ? {
          label: "Collected",
          value: formatINR(fees?.totalCollected ?? 0),
          formula: "Total fee payments received for active fee assignments.",
          href: "/fees",
          tone: "amber" as const
        }
      : {
          label: "Assigned Classes",
          value: totalClasses,
          formula: "Total classes assigned to you.",
          href: "/teacher/classes",
          tone: "blue" as const
        },
    mode === "ADMIN"
      ? {
          label: "Alerts",
          value: kpis.alerts ?? data?.alerts?.length ?? 0,
          helper: "Opens risk insights",
          formula: "Below 75% attendance + repeat absentees + high severity risks.",
          href: "/analytics",
          tone: "purple" as const
        }
      : null
  ].filter(Boolean) as Kpi[];

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
      actionLabel: sendingReminderId === item.studentId ? "Sending..." : "Send Reminder",
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
        href: "/reports/daily-attendance"
      }))
  ].slice(0, 6) : [];

  /* ── Fee chart segments ── */
  const totalCollected = Number(fees?.totalCollected ?? 0);
  const totalPending = Number(fees?.totalPending ?? 0);
  const totalOverdue = Math.min(Number(fees?.totalOverdue ?? 0), totalPending);
  const feeSegments = [
    { label: "Collected", value: totalCollected, color: "#34c759" },
    { label: "Pending", value: totalPending, color: "#ff9500" },
    { label: "Overdue", value: totalOverdue, color: "#ff3b30" },
  ];
  const teacherWorkSegments = [
    { label: "Marked", value: markedClasses, color: "#34c759" },
    { label: "Unmarked", value: pendingClasses, color: "#ff9500" },
    { label: "Homework", value: teacherPendingHomework, color: "#7c3aed" }
  ];
  const activityEvents = buildActivityEvents(activityLogs);
  const maxActivityDate = dateInputValue(new Date());
  const paymentModal = paymentModalOpen && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <button aria-label="Close payment search" className="absolute inset-0" onClick={() => setPaymentModalOpen(false)} type="button" />
      <div className="relative flex max-h-[min(680px,calc(100vh-48px))] w-full max-w-xl flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_24px_80px_-28px_rgba(15,20,25,0.55)]">
        <div className="border-b border-[#E7EBF0] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-semibold text-[#0F1419]">Record Payment</h2>
              <p className="mt-1 text-[13px] text-[#5A6573]">Search student, then open fee ledger.</p>
            </div>
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#5A6573] hover:bg-[#F7F8FB]" onClick={() => setPaymentModalOpen(false)} type="button" aria-label="Close">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mt-4 flex min-h-11 items-center gap-2 rounded-[8px] border border-[#C9D3DE] bg-white px-3">
            <svg className="h-4 w-4 shrink-0 text-[#5A6573]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              autoFocus
              type="text"
              className="min-w-0 flex-1 appearance-none !border-none bg-transparent text-[14px] font-medium text-[#0F1419] !outline-none !shadow-none focus:!border-transparent focus:!ring-0 focus:!outline-none focus:!shadow-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!outline-none placeholder:text-[#8C96A3]"
              style={{ border: "none", outline: "none", boxShadow: "none" }}
              onChange={(event) => setPaymentSearch(event.target.value)}
              placeholder="Search by student name, admission no, or phone"
              value={paymentSearch}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {paymentError ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{paymentError}</div> : null}
          {paymentLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="h-16 animate-pulse rounded-[8px] bg-[#F2F5F8]" key={index} />
              ))}
            </div>
          ) : paymentStudents.length === 0 && !paymentError ? (
            <div className="px-4 py-10 text-center text-[13px] font-medium text-[#86868b]">No students found.</div>
          ) : (
            <div className="space-y-2">
              {paymentStudents.map((student) => (
                <Link
                  className="flex min-h-16 items-center justify-between gap-3 rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-3 transition hover:border-[#2456E6] hover:bg-[#F7F8FB]"
                  href={`/fees/${student.id}`}
                  key={student.id}
                  onClick={() => setPaymentModalOpen(false)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-[#0F1419]">{student.fullName}</span>
                    <span className="mt-0.5 block truncate text-[12px] font-medium text-[#5A6573]">
                      {student.class.name}-{student.class.section} | {student.admissionNumber}{student.parentPhone ? ` | ${student.parentPhone}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-[6px] bg-[#2456E6] px-3 py-1.5 text-[12px] font-semibold text-white">Open</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      {paymentModal}
      {!loading && data ? <p className="text-[14px] font-medium leading-6 text-[#5A6573]">{pulseText}</p> : null}

      {error ? <div className="rounded-xl bg-[#ff9500]/10 px-4 py-3 text-[13px] font-medium text-[#c93400]">{error}</div> : null}
      {notice ? (
        <div className="flex items-center justify-between rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">
          <span>{notice}</span>
          <button className="font-semibold underline-offset-2 hover:underline" onClick={() => setNotice("")} type="button">Dismiss</button>
        </div>
      ) : null}

      {mode === "ADMIN" ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#2456E6] px-4 py-2 text-center text-[13px] font-semibold text-white hover:bg-[#1B45BD]" href="/attendance">Mark Today&apos;s Attendance</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-center text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href="/fees/defaulters">Send Fee Reminder</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-center text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href="/students/new">Add Student</Link>
          <button className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-center text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => setPaymentModalOpen(true)} type="button">Record Payment</button>
        </div>
      ) : null}

      {/* ═══ Row 1 — KPI Summary Cards ═══ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          adminKpis.map((kpi, index) => <DashboardKpiCard index={index} key={kpi.label} kpi={kpi} />)
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
              title={mode === "ADMIN" ? "Attendance in Marked Classes" : "Your Class Attendance"}
              classes={(data?.attendance ?? []).map((a) => a.className)}
            />
            <FeeOverviewChart
              eyebrow={mode === "ADMIN" ? "Finance" : "Teacher Workload"}
              segments={mode === "ADMIN" ? feeSegments : teacherWorkSegments}
              title={mode === "ADMIN" ? "Fee Overview" : "Today's Actions"}
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
            <ActivityFeed events={activityEvents} maxDate={maxActivityDate} onDateChange={setActivityDate} selectedDate={activityDate} />
          </>
        )}
      </section>
    </div>
  );
}
