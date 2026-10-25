"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { leaveApi, staffAttendanceApi, teachersApi, type LeavePage, type StaffMonthSummary, type TeacherDetail } from "@/lib/api";
import { cachedFetch } from "@/lib/prefetchCache";
import { TeacherProfileTabs } from "./TeacherProfileTabs";

/** The day's month as a YYYY-MM string in the viewer's local timezone. */
export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const timetableDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

/** Weekly periods that point at a real class — free periods do not count. */
export function assignedPeriodCount(teacher: TeacherDetail) {
  const days = new Set<string>(timetableDays);
  return teacher.periodAssignments.filter(
    (period) => period.classId && days.has(period.dayOfWeek) && period.periodNumber <= teacher.timetablePeriodCount
  ).length;
}

export function totalTimetableSlots(teacher: TeacherDetail) {
  return timetableDays.length * teacher.timetablePeriodCount;
}

function classTeacherLabel(teacher: TeacherDetail) {
  const classes = teacher.classTeacherFor ?? [];
  return classes.length ? classes.map((item) => `${item.name}-${item.section}`).join(", ") : "None";
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

type KpiTone = "good" | "warn" | "danger" | "neutral";

const kpiToneStyles: Record<KpiTone, { accent: string; iconBg: string }> = {
  neutral: { accent: "text-[#5A6573]", iconBg: "bg-[#F2F5F8]" },
  good: { accent: "text-[#0F8A4A]", iconBg: "bg-[#E1F5EA]" },
  warn: { accent: "text-[#B95A00]", iconBg: "bg-[#FFF2DC]" },
  danger: { accent: "text-[#C8242C]", iconBg: "bg-[#FCE3E5]" }
};

function MiniKpiCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: KpiTone }) {
  const s = kpiToneStyles[tone];
  return (
    <div className="flex min-h-[88px] items-center gap-3 rounded-[6px] border border-[#E2E7EE] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:gap-4 sm:px-5 sm:py-4">
      <div className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-[8px] sm:flex ${s.iconBg}`}>
        <span className={`text-[18px] font-bold ${s.accent}`}>{value.slice(0, 1)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-5 text-[#52687D]">{label}</p>
        <p className="mt-0.5 truncate text-[24px] font-semibold leading-8 text-[#0F2233]">{value}</p>
      </div>
    </div>
  );
}

function TeacherProfileLoading() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white">
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-[6px]" />
            <Skeleton className="h-9 w-24 rounded-[6px]" />
          </div>
        </div>
        <div className="mx-5 border-t border-[rgba(0,0,0,0.05)]" />
        <div className="grid grid-cols-2 gap-2.5 px-5 py-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-[6px]" />
          ))}
        </div>
      </div>
      <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-1.5">
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-[6px]" />
          ))}
        </div>
      </div>
      <Skeleton className="h-64 rounded-[6px]" />
    </div>
  );
}

export function TeacherProfilePage() {
  const params = useParams<{ id: string }>();
  const month = currentMonth();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [attendance, setAttendance] = useState<StaffMonthSummary | null>(null);
  const [leave, setLeave] = useState<LeavePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      cachedFetch(`teacher:${params.id}:detail`, () => teachersApi.get(params.id)),
      staffAttendanceApi.userSummary(params.id, month).catch(() => null),
      leaveApi.schoolRequests({ userId: params.id, limit: 50 }).catch(() => null)
    ])
      .then(([teacherData, attendanceData, leaveData]) => {
        if (!active) return;
        setTeacher(teacherData);
        setAttendance(attendanceData);
        setLeave(leaveData);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load teacher");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.id, month]);

  if (loading) return <TeacherProfileLoading />;
  if (error) return <div className="rounded-[6px] border border-[#FCE3E5] bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;
  if (!teacher) return <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-12 text-center text-[13px] text-[#86868b]">Teacher not found.</div>;

  const assigned = assignedPeriodCount(teacher);
  const total = totalTimetableSlots(teacher);
  const attendanceTone: KpiTone = attendance?.percentage == null ? "neutral" : attendance.percentage >= 85 ? "good" : attendance.percentage >= 75 ? "warn" : "danger";
  const pendingLeave = leave?.summary.pending ?? 0;

  return (
    <div className="space-y-4">
      <section className="overflow-visible rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4 lg:flex-1">
            <InitialsAvatar name={teacher.fullName} size="md" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[18px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[22px]">{teacher.fullName}</h1>
              <p className="mt-0.5 truncate text-[12px] font-medium text-[#86868b]">
                {teacher.email || teacher.phone || "-"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-[6px]">
                <StatusPill label={teacher.status} tone={teacher.status === "ACTIVE" ? "good" : "warn"} />
                <span className="inline-flex items-center rounded-md border border-transparent bg-[rgba(0,0,0,0.04)] px-2 py-1 text-[11px] font-semibold text-[#6e6e73]">
                  Class Teacher: {classTeacherLabel(teacher)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 lg:shrink-0">
            <Link
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#0071e3] px-3.5 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-[#005bb5]"
              href={`/teachers/${teacher.id}/edit`}
            >
              Edit
            </Link>
            <a
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[#DCE1E8] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#1d1d1f] transition-all duration-200 hover:bg-[#F7F8FB]"
              href={`tel:${teacher.phone}`}
            >
              Call
            </a>
            {teacher.phone ? (
              <a
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#25d366] px-3.5 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-[#20bd5a]"
                href={whatsappLink(teacher.phone)}
                rel="noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>

        <div className="mx-4 border-t border-[#E7EBF0] sm:mx-5" />

        <div className="grid grid-cols-2 gap-2.5 px-4 py-3 sm:px-5 lg:grid-cols-4">
          <MiniKpiCard label={`Attendance (${month})`} value={attendance?.percentage == null ? "No data" : `${attendance.percentage}%`} tone={attendanceTone} />
          <MiniKpiCard label="Present this month" value={attendance ? `${attendance.presentDays}/${attendance.workingDays}` : "-"} tone="neutral" />
          <MiniKpiCard label="Weekly periods" value={`${assigned}/${total}`} tone="neutral" />
          <MiniKpiCard label="Pending leave" value={String(pendingLeave)} tone={pendingLeave > 0 ? "warn" : "good"} />
        </div>
      </section>

      <TeacherProfileTabs teacher={teacher} initialAttendance={attendance} initialMonth={month} leave={leave} />
    </div>
  );
}
