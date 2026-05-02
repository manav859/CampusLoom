"use client";

import { AttendanceList } from "@/components/AttendanceList";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { PageHeader } from "@/components/ui/PageHeader";
import { AttendanceListSkeleton } from "@/components/ui/Skeleton";
import { useAttendance } from "@/hooks/useAttendance";

export default function TeacherAttendancePage() {
  const attendance = useAttendance();
  const classLabel = attendance.selectedClass ? `${attendance.selectedClass.name}-${attendance.selectedClass.section}` : "Class";
  const submitDisabled = !attendance.canEdit || attendance.submitting || attendance.loading || attendance.students.length === 0;
  const monthlyByDate = new Map((attendance.monthly?.days ?? []).map((day) => [day.date, day]));
  const [monthYear = 0, monthNumber = 1] = attendance.selectedMonth.split("-").map(Number);
  const firstOfMonth = new Date(monthYear, monthNumber - 1, 1);
  const daysInMonth = new Date(monthYear, monthNumber, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstOfMonth.getDay() }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 }))
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Reliable attendance"
        action={
          <button
            type="button"
            className="btn-secondary"
            onClick={attendance.markAllPresent}
            disabled={!attendance.canEdit || attendance.submitting || attendance.loading}
          >
            Reset all present
          </button>
        }
      />

      <div className="glass-card-interactive p-5">
        <p className="text-[13px] text-[#86868b]">Mark present, late, or absent for any date. Saved days can be reopened and edited.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px]">
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
          <input
            className="glass-input min-h-[48px] text-[15px] font-semibold"
            type="date"
            value={attendance.selectedDate}
            onChange={(event) => attendance.selectDate(event.target.value)}
            disabled={attendance.loading || attendance.submitting}
          />
          <input
            className="glass-input min-h-[48px] text-[15px] font-semibold"
            type="month"
            value={attendance.selectedMonth}
            onChange={(event) => attendance.selectMonth(event.target.value)}
            disabled={attendance.loading || attendance.submitting}
          />
        </div>
      </div>

      <AttendanceSummary total={attendance.summary.total} present={attendance.summary.present} absent={attendance.summary.absent} late={attendance.summary.late} />

      <section className="glass-card-interactive space-y-4 p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">Monthly view</p>
            <h2 className="text-[20px] font-semibold text-[#1d1d1f]">{classLabel} attendance calendar</h2>
          </div>
          <p className="text-[13px] text-[#86868b]">Tap any day to load or edit attendance.</p>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarCells.map((cell) => {
            if (!cell.day) return <div aria-hidden="true" key={cell.key} className="min-h-[76px]" />;

            const dateKey = `${attendance.selectedMonth}-${String(cell.day).padStart(2, "0")}`;
            const day = monthlyByDate.get(dateKey);
            const selected = attendance.selectedDate === dateKey;
            const hasWarning = Boolean(day && (day.absent > 0 || day.late > 0));

            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => attendance.selectDate(dateKey)}
                disabled={attendance.loading || attendance.submitting}
                className={`min-h-[76px] rounded-2xl border p-2 text-left transition hover:shadow-apple-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "border-[#007aff] bg-[#007aff]/10"
                    : day
                      ? hasWarning
                        ? "border-[#ff9500]/20 bg-[#ff9500]/[0.06]"
                        : "border-[#34c759]/15 bg-[#34c759]/[0.05]"
                      : "border-[rgba(0,0,0,0.06)] bg-white/50"
                }`}
              >
                <span className="block text-[13px] font-semibold text-[#1d1d1f]">{cell.day}</span>
                {day ? (
                  <span className="mt-2 block space-y-0.5 text-[11px] text-[#6e6e73]">
                    <span className="block font-semibold text-[#1d1d1f]">{day.percentage}%</span>
                    <span className="block">{day.absent} absent</span>
                    <span className="block">{day.late} late</span>
                  </span>
                ) : (
                  <span className="mt-3 block text-[11px] text-[#86868b]">Unmarked</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="glass-card-interactive flex flex-col gap-2 px-5 py-4 text-[13px] sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-[#1d1d1f]">{classLabel}</span>
        <span className="text-[#86868b]">
          {attendance.selectedDate} {attendance.marked ? "- saved" : "- unsaved"}
        </span>
      </div>

      {attendance.loading ? (
        <AttendanceListSkeleton rows={8} />
      ) : (
        <AttendanceList
          students={attendance.students}
          onToggle={attendance.toggleStudent}
          onSetStatus={attendance.setStudentStatus}
          disabled={!attendance.canEdit || attendance.submitting}
        />
      )}

      {attendance.error || attendance.success ? (
        <div className="fixed inset-x-0 bottom-[88px] z-50 flex justify-center px-4 pointer-events-none" role="status" aria-live="polite">
          <div
            className={`rounded-full px-5 py-2.5 text-[14px] font-semibold shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-center gap-2 ${
              attendance.error ? "bg-white/95 text-[#d70015] border border-[#ff3b30]/20" : "bg-[#34c759] text-white border border-[#34c759]/20"
            }`}
          >
            {attendance.error ? (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {attendance.error || attendance.success}
          </div>
        </div>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgba(0,0,0,0.06)] bg-white/80 px-4 pt-3 backdrop-blur-apple md:sticky md:inset-auto md:bottom-4 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            className="btn-primary min-h-[52px] w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={attendance.submitAttendance}
            disabled={submitDisabled}
          >
            {attendance.submitting ? "Saving..." : attendance.marked ? "Save Attendance Changes" : "Submit Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}
