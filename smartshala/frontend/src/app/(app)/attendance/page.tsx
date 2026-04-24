"use client";

import { AttendanceList } from "@/components/AttendanceList";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { PageHeader } from "@/components/ui/PageHeader";
import { AttendanceListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useAttendance } from "@/hooks/useAttendance";

export default function TeacherAttendancePage() {
  const attendance = useAttendance();
  const classLabel = attendance.selectedClass ? `${attendance.selectedClass.name}-${attendance.selectedClass.section}` : "Class";
  const submitDisabled = attendance.marked || attendance.submitting || attendance.loading || attendance.students.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Tap absent students"
        action={
          <button
            type="button"
            className="btn-secondary"
            onClick={attendance.markAllPresent}
            disabled={attendance.marked || attendance.submitting || attendance.loading}
          >
            Reset all present
          </button>
        }
      />

      <div className="glass-card-interactive p-5">
        <p className="text-[13px] text-[#86868b]">Everyone starts as present. Only tap students who are absent.</p>
        <div className="mt-4">
          <select
            className="glass-input min-h-[48px] text-[15px] font-semibold"
            value={attendance.selectedClassId}
            onChange={(event) => attendance.selectClass(event.target.value)}
            disabled={attendance.loading || attendance.submitting}
          >
            {attendance.classes.length === 0 ? <option value="">No assigned class</option> : null}
            {attendance.classes.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}-{classItem.section}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AttendanceSummary total={attendance.summary.total} present={attendance.summary.present} absent={attendance.summary.absent} />

      <div className="glass-card-interactive flex flex-col gap-2 px-5 py-4 text-[13px] sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-[#1d1d1f]">{classLabel}</span>
        <span className="text-[#86868b]">{attendance.today}</span>
      </div>

      {attendance.loading ? (
        <AttendanceListSkeleton rows={8} />
      ) : (
        <AttendanceList students={attendance.students} onToggle={attendance.toggleStudent} disabled={attendance.marked || attendance.submitting} />
      )}

      {attendance.error || attendance.success ? (
        <div className="fixed inset-x-0 bottom-[88px] z-30 px-4 sm:px-6" role="status" aria-live="polite">
          <div
            className={`mx-auto max-w-4xl rounded-2xl px-4 py-3 text-[13px] font-semibold shadow-apple ${
              attendance.error ? "bg-[#ff3b30]/10 text-[#d70015]" : "bg-[#34c759]/10 text-[#248a3d]"
            }`}
          >
            {attendance.error || attendance.success}
          </div>
        </div>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgba(0,0,0,0.06)] bg-white/80 px-4 pt-3 backdrop-blur-apple md:sticky md:inset-auto md:bottom-4 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            className="btn-primary min-h-[52px] w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={attendance.submitAttendance}
            disabled={submitDisabled}
          >
            {attendance.submitting ? "Submitting…" : attendance.marked ? "Attendance Submitted ✓" : "Submit Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}
