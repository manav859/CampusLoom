"use client";

import { useEffect, useState } from "react";
import { AttendanceList } from "@/components/AttendanceList";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { Button } from "@/components/ui/Button";
import { Modal, ModalCloseButton } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AttendanceListSkeleton } from "@/components/ui/Skeleton";
import { useAttendance } from "@/hooks/useAttendance";
import { attendanceApi, type ClassSummary, type DailyAttendanceRow } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";

function calendarDayClasses(input: { selected: boolean; marked: boolean; isHoliday: boolean }) {
  if (input.selected) {
    return input.marked
      ? "border-[#007aff] bg-[#34c759]/15 ring-2 ring-[#007aff]/25"
      : input.isHoliday
        ? "border-[#8e8e93]/30 bg-[#f5f5f7] ring-2 ring-[#007aff]/20"
        : "border-[#007aff] bg-[#007aff]/10";
  }

  if (input.marked) return "border-[#34c759]/25 bg-[rgba(52,199,89,0.12)]";
  if (input.isHoliday) return "border-[#d1d1d6] bg-[#f5f5f7]";
  return "border-[rgba(0,0,0,0.06)] bg-white/50";
}

function classGroupName(className: string) {
  const grade = Number.parseInt(className, 10);
  if (!Number.isFinite(grade)) return "Other";
  if (grade <= 5) return "Primary";
  if (grade <= 8) return "Middle";
  return "Secondary";
}

function groupedClasses(classes: ClassSummary[]) {
  const groups = new Map<string, ClassSummary[]>();
  classes.forEach((classItem) => {
    const group = classGroupName(classItem.name);
    groups.set(group, [...(groups.get(group) ?? []), classItem]);
  });
  return ["Primary", "Middle", "Secondary", "Other"]
    .map((group) => ({ group, classes: groups.get(group) ?? [] }))
    .filter((item) => item.classes.length > 0);
}

export default function TeacherAttendancePage() {
  const attendance = useAttendance();
  const [classSearch, setClassSearch] = useState("");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [todayRows, setTodayRows] = useState<DailyAttendanceRow[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const classLabel = attendance.selectedClass ? `${attendance.selectedClass.name}-${attendance.selectedClass.section}` : "Class";
  const submitDisabled = !attendance.canEdit || attendance.submitting || attendance.loading || attendance.students.length === 0;
  const selectedDateLabel = formatDateShort(attendance.selectedDate);
  const monthlyByDate = new Map((attendance.monthly?.days ?? []).map((day) => [day.date, day]));
  const [monthYear = 0, monthNumber = 1] = attendance.selectedMonth.split("-").map(Number);
  const firstOfMonth = new Date(monthYear, monthNumber - 1, 1);
  const daysInMonth = new Date(monthYear, monthNumber, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstOfMonth.getDay() }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 }))
  ];
  const currentPeriodLabel = "My current period";
  const filteredClassGroups = groupedClasses(
    attendance.classes.filter((classItem) => `${classItem.name}-${classItem.section}`.toLowerCase().includes(classSearch.trim().toLowerCase()))
  );

  useEffect(() => {
    let active = true;
    attendanceApi.daily()
      .then((rows) => {
        if (active) setTodayRows(rows);
      })
      .catch(() => {
        if (active) setTodayRows([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const requestedClassId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("classId") : null;
    if (!requestedClassId || attendance.loading || attendance.selectedClassId === requestedClassId) return;
    if (attendance.classes.some((classItem) => classItem.id === requestedClassId)) {
      void attendance.selectClass(requestedClassId);
    }
  }, [attendance]);

  useEffect(() => {
    if (!attendance.error && !attendance.success) return;
    setShowFeedback(true);
    const timeout = window.setTimeout(() => setShowFeedback(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [attendance.error, attendance.success]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Reliable attendance"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(0,0,0,0.08)] bg-white text-[13px] font-bold text-[#5A6573] shadow-apple-sm"
              aria-label="Reliable attendance details"
              title="Reliable attendance uses saved roster records as the source of truth for daily totals, monthly charts, and student profiles."
            >
              i
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setResetConfirmOpen(true)}
              disabled={!attendance.canEdit || attendance.submitting || attendance.loading}
            >
              Reset all present
            </button>
          </div>
        }
      />

      <div className="glass-card-interactive p-5">
        <p className="text-[13px] text-[#86868b]">Mark present, late, or absent for any date. Saved days can be reopened and edited.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white/70 p-2">
            <input
              className="mb-2 w-full rounded-xl border border-[#DCE1E8] bg-white px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#2456E6]"
              disabled={attendance.loading || attendance.submitting}
              onChange={(event) => setClassSearch(event.target.value)}
              placeholder="Search class"
              value={classSearch}
            />
            <select
              className="w-full rounded-xl border border-transparent bg-white px-3 py-2.5 text-[15px] font-semibold text-[#1d1d1f] outline-none"
              value={attendance.selectedClassId}
              onChange={(event) => attendance.selectClass(event.target.value)}
              disabled={attendance.loading || attendance.submitting}
            >
              {attendance.classes.length === 0 ? <option value="">No assigned class</option> : null}
              {filteredClassGroups.map((item) => (
                <optgroup key={item.group} label={item.group}>
                  {item.classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}-{classItem.section}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-2 text-[11px] font-medium text-[#86868b]">Last selected class is remembered for this user.</p>
          </div>
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
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#2456E6]/10 px-3 py-1 text-[12px] font-semibold text-[#2456E6]">{currentPeriodLabel}</span>
          {todayRows.length === 0 ? (
            <span className="rounded-full bg-[#F1F3F6] px-3 py-1 text-[12px] font-semibold text-[#5A6573]">Today status loading</span>
          ) : (
            todayRows.slice(0, 6).map((row) => (
              <button
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                  row.marked ? "bg-[#E1F5EA] text-[#0F8A4A]" : "bg-[#FFF2DC] text-[#B95A00]"
                }`}
                key={row.classId}
                onClick={() => attendance.selectClass(row.classId)}
                type="button"
              >
                {row.className}: {row.marked ? "Marked" : "Unmarked"}
              </button>
            ))
          )}
        </div>
      </div>

      <AttendanceSummary
        total={attendance.summary.total}
        present={attendance.summary.present}
        absent={attendance.summary.absent}
        late={attendance.summary.late}
        halfDay={attendance.summary.halfDay}
        attended={attendance.summary.attended}
      />

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
            const date = new Date(monthYear, monthNumber - 1, cell.day);
            const isSunday = date.getDay() === 0;
            const isHoliday = isSunday || Boolean((day as { isHoliday?: boolean } | undefined)?.isHoliday);

            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => attendance.selectDate(dateKey)}
                disabled={attendance.loading || attendance.submitting}
                className={`min-h-[76px] rounded-2xl border p-2 text-left transition hover:shadow-apple-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                  calendarDayClasses({ selected, marked: Boolean(day), isHoliday })
                }`}
              >
                <span className="block text-[13px] font-semibold text-[#1d1d1f]">{cell.day}</span>
                {day ? (
                  <span className="mt-2 block space-y-0.5 text-[11px] text-[#6e6e73]">
                    <span className="block font-semibold text-[#1d1d1f]">{day.percentage}%</span>
                    <span className="block">{day.absent} absent</span>
                    {day.halfDay ? <span className="block">{day.halfDay} half-day</span> : null}
                    <span className="block">{day.late} late</span>
                  </span>
                ) : isHoliday ? (
                  <span className="mt-3 block text-[11px] font-medium text-[#86868b]">{isSunday ? "Sunday" : "Holiday"}</span>
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
          {selectedDateLabel} - {attendance.marked ? "Saved" : "Unsaved"}
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

      {showFeedback && (attendance.error || attendance.success) ? (
        <div className="fixed right-4 top-4 z-50 flex justify-end px-4 pointer-events-none" role="status" aria-live="polite">
          <div
            className={`rounded-xl px-5 py-2.5 text-[14px] font-semibold shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2 ${
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
        <div className="mx-auto flex max-w-5xl justify-end">
          <button
            type="button"
            className="btn-primary min-h-[52px] w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50 sm:w-[232px]"
            onClick={attendance.submitAttendance}
            disabled={submitDisabled}
          >
            {attendance.submitting ? "Saving attendance..." : "Save attendance"}
          </button>
        </div>
      </div>

      <Modal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Reset all present?"
        description={`This changes every ${classLabel} student on ${selectedDateLabel} to Present. Review the list before saving.`}
        footer={
          <>
            <ModalCloseButton onClick={() => setResetConfirmOpen(false)} />
            <Button
              onClick={() => {
                attendance.markAllPresent();
                setResetConfirmOpen(false);
              }}
              variant="primary"
            >
              Reset all present
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-6 text-[var(--ink-500)]">
          Existing Absent, Late, and Half day selections in the current roster will become Present locally. The change is saved only after you use Save attendance.
        </p>
      </Modal>
    </div>
  );
}
