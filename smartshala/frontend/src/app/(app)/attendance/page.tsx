"use client";

import { AttendanceList } from "@/components/AttendanceList";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { useAttendance } from "@/hooks/useAttendance";

export default function TeacherAttendancePage() {
  const attendance = useAttendance();
  const classLabel = attendance.selectedClass ? `${attendance.selectedClass.name}-${attendance.selectedClass.section}` : "Class";
  const submitDisabled = attendance.marked || attendance.submitting || attendance.loading || attendance.students.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-action">Attendance</p>
          <h1 className="text-2xl font-bold text-ink">Tap absent students</h1>
          <p className="mt-1 text-sm text-neutral-600">Everyone starts as present. Only tap students who are absent.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <select
            className="min-h-12 rounded-xl border border-line bg-panel px-3 text-base font-semibold text-ink"
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
          <button
            type="button"
            className="min-h-12 rounded-xl border border-line bg-panel px-4 text-sm font-bold text-neutral-700 disabled:opacity-50"
            onClick={attendance.markAllPresent}
            disabled={attendance.marked || attendance.submitting || attendance.loading}
          >
            Reset all present
          </button>
        </div>
      </header>

      <AttendanceSummary total={attendance.summary.total} present={attendance.summary.present} absent={attendance.summary.absent} />

      {attendance.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{attendance.error}</div> : null}
      {attendance.success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{attendance.success}</div> : null}

      <div className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm">
        <span className="font-semibold text-ink">{classLabel}</span>
        <span className="text-neutral-600">{attendance.today}</span>
      </div>

      {attendance.loading ? (
        <div className="rounded-xl border border-line bg-panel px-4 py-10 text-center text-sm font-medium text-neutral-600">Loading attendance...</div>
      ) : (
        <AttendanceList students={attendance.students} onToggle={attendance.toggleStudent} disabled={attendance.marked || attendance.submitting} />
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-4 shadow-[0_-12px_30px_rgba(23,33,28,0.12)] backdrop-blur md:left-64">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            className="min-h-14 w-full rounded-xl bg-action px-5 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            onClick={attendance.submitAttendance}
            disabled={submitDisabled}
          >
            {attendance.submitting ? "Submitting..." : attendance.marked ? "Attendance Submitted" : "Submit Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}
