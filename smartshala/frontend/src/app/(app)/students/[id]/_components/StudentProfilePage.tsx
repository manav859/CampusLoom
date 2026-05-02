"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { studentsApi, type StudentDetail } from "@/lib/api";
import { StickyHeader } from "./StickyHeader";
import { StudentProfileTabs } from "./StudentProfileTabs";
import {
  currentMonthAttendance,
  daysSinceLastAbsent,
  fallbackPerformanceClassification,
  latestAbsentDate,
  performanceClassification,
  performanceRate
} from "./studentProfileUtils";

/* ── Skeleton that mirrors the real page structure ── */
function StudentProfileLoading() {
  return (
    <div className="space-y-4">
      {/* ── Header skeleton ── */}
      <div className="rounded-[14px] border border-[rgba(0,0,0,0.04)] bg-white/70 overflow-hidden">
        {/* Top row: identity + actions */}
        <div className="flex flex-col gap-3 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Skeleton className="hidden sm:block h-11 w-11 rounded-[10px] shrink-0" />
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-40 rounded-md" />
                <Skeleton className="hidden sm:block h-3 w-28 rounded-md" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-5 w-28 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-[rgba(0,0,0,0.05)]" />

        {/* Bottom row: KPI mini-cards */}
        <div className="grid grid-cols-2 gap-2.5 px-5 py-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[10px] border border-[rgba(0,0,0,0.04)] bg-[#f5f5f7]/50 pl-[18px] pr-3 py-2.5">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="mt-1.5 h-3 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs skeleton ── */}
      <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-1.5">
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* ── Tab panel skeleton ── */}
      <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-6 space-y-4">
        <Skeleton className="h-5 w-36 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

export function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    studentsApi.get(params.id)
      .then((data) => {
        if (active) setStudent(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load student");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  if (loading) {
    return <StudentProfileLoading />;
  }

  if (error) {
    return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;
  }

  if (!student) {
    return <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-12 text-center text-[13px] text-[#86868b] shadow-apple-sm">Student not found.</div>;
  }

  const attendance = currentMonthAttendance(student.attendanceRecords);
  const allowedTabs = new Set(student.access?.allowedTabs ?? ["academic", "homework", "attendance", "fees", "communication", "behaviour", "documents"]);
  const canViewAcademic = allowedTabs.has("academic");
  const canViewAttendance = allowedTabs.has("attendance");
  const canViewFees = allowedTabs.has("fees");
  const pendingFees = student.feeAssignments.reduce((sum, assignment) => sum + Number(assignment.pendingAmount ?? 0), 0);
  const paidFees = student.feeAssignments.reduce((sum, assignment) => sum + Number(assignment.paidAmount ?? 0), 0);
  const attendancePercentage = student.attendancePercentage ?? attendance.percentage;
  const feeBalance = student.feeBalance ?? pendingFees;
  const lastAbsentDate = student.lastAbsentDate ?? latestAbsentDate(student.attendanceRecords);
  const daysAbsent = daysSinceLastAbsent(lastAbsentDate);
  const performance = student.performanceRate ?? performanceRate(student.examAverage, student.homeworkCompletion, attendancePercentage);
  const classification =
    student.performanceClassification ??
    performanceClassification(performance) ??
    fallbackPerformanceClassification(attendancePercentage, feeBalance);
  const isPerformanceFallback = performance === null;
  const attendanceWithSnapshot = { ...attendance, percentage: attendancePercentage };

  return (
    <div className="space-y-4">
      <StickyHeader
        student={student}
        attendancePercentage={attendancePercentage}
        currentRank={student.currentRank ?? null}
        feeBalance={feeBalance}
        daysSinceLastAbsent={daysAbsent}
        performanceRate={performance}
        performanceClassification={classification}
        isPerformanceFallback={isPerformanceFallback}
        canViewAcademic={canViewAcademic}
        canViewAttendance={canViewAttendance}
        canViewFees={canViewFees}
      />
      <StudentProfileTabs student={student} attendance={attendanceWithSnapshot} pendingFees={feeBalance} paidFees={paidFees} />
    </div>
  );
}
