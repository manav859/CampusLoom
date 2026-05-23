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
  if (grade <= 8) return "Upper Primary";
  if (grade <= 10) return "Secondary";
  return "Senior (Sr.) Secondary";
}

function groupedClasses(classes: ClassSummary[]) {
  const groups = new Map<string, ClassSummary[]>();
  classes.forEach((classItem) => {
    const group = classGroupName(classItem.name);
    groups.set(group, [...(groups.get(group) ?? []), classItem]);
  });
  return ["Primary", "Upper Primary", "Secondary", "Senior (Sr.) Secondary", "Other"]
    .map((group) => ({ group, classes: groups.get(group) ?? [] }))
    .filter((item) => item.classes.length > 0);
}

type MonthlyDay = NonNullable<ReturnType<typeof useAttendance>["monthly"]>["days"][number];

function summaryFromMonthlyDay(day: MonthlyDay, fallbackTotal: number) {
  const total = day.total || fallbackTotal;
  const late = day.late ?? 0;
  const halfDay = day.halfDay ?? 0;
  const attended = day.attended || Math.round((day.percentage / 100) * total);
  const present = day.total ? day.present : Math.max(0, Math.round(attended - late - halfDay * 0.5));
  const absent = day.total ? day.absent : Math.max(0, total - present - late - halfDay);

  return { total, present, absent, late, halfDay, attended };
}

export default function TeacherAttendancePage() {
  const attendance = useAttendance();
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [calendarDetailDate, setCalendarDetailDate] = useState("");
  const [selectedClassDisplay, setSelectedClassDisplay] = useState("");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [todayRows, setTodayRows] = useState<DailyAttendanceRow[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const selectedClassRecord = attendance.selectedClass ?? attendance.classes.find((classItem) => classItem.id === attendance.selectedClassId);
  const classLabel = selectedClassRecord
    ? `${selectedClassRecord.name}-${selectedClassRecord.section}`
    : selectedClassDisplay || attendance.monthly?.className || (attendance.classes.length > 0 ? "Select class" : "No assigned class");
  const submitDisabled = !attendance.canEdit || attendance.submitting || attendance.loading || attendance.students.length === 0;
  const selectedDateLabel = formatDateShort(attendance.selectedDate);
  const monthlyByDate = new Map((attendance.monthly?.days ?? []).map((day) => [day.date, day]));
  const calendarDetailDateKey = calendarDetailDate || attendance.selectedDate;
  const calendarDetailLabel = formatDateShort(calendarDetailDateKey);
  const selectedMonthDay = monthlyByDate.get(calendarDetailDateKey);
  const summary = selectedMonthDay ? summaryFromMonthlyDay(selectedMonthDay, attendance.monthly?.totalStudents ?? attendance.summary.total) : attendance.summary;
  const [monthYear = 0, monthNumber = 1] = attendance.selectedMonth.split("-").map(Number);
  const firstOfMonth = new Date(monthYear, monthNumber - 1, 1);
  const daysInMonth = new Date(monthYear, monthNumber, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstOfMonth.getDay() }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 }))
  ];
  const currentPeriodLabel = "My current period";
  const classGroups = groupedClasses(attendance.classes);

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

  useEffect(() => {
    if (!calendarDetailDate) setCalendarDetailDate(attendance.selectedDate);
  }, [attendance.selectedDate, calendarDetailDate]);

  useEffect(() => {
    if (selectedClassRecord) setSelectedClassDisplay(`${selectedClassRecord.name}-${selectedClassRecord.section}`);
  }, [selectedClassRecord]);

  return (
    <div className="w-full space-y-6">
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

      <div className="rounded-md border border-[#E2E7EE] bg-white p-5 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)]">
        <p className="text-[13px] text-[#86868b]">Mark present, late, or absent for any date. Saved days can be reopened and edited.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(280px,440px)_1fr]">
          <div className="relative rounded-md border border-[#E2E7EE] bg-white p-2 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)]">
            <button
              aria-expanded={classPickerOpen}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#DCE1E8] bg-white px-3 py-2.5 text-left text-[15px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#AAB4C2] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={attendance.loading || attendance.submitting}
              onClick={() => setClassPickerOpen((open) => !open)}
              type="button"
            >
              <span>{classLabel}</span>
              <svg className={`h-4 w-4 text-[#5A6573] transition ${classPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {classPickerOpen ? (
              <div className="absolute left-2 right-2 top-[58px] z-30 max-h-[340px] overflow-auto rounded-2xl border border-[#DCE1E8] bg-white p-2 shadow-[var(--shadow-menu)]">
                {attendance.classes.length === 0 || classGroups.length === 0 ? (
                  <div className="rounded-xl bg-[#F7F8FB] px-3 py-3 text-[13px] font-semibold text-[#86868b]">No assigned class</div>
                ) : (
                  classGroups.map((item) => (
                    <div key={item.group} className="py-1">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#86868b]">{item.group}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {item.classes.map((classItem) => {
                          const className = `${classItem.name}-${classItem.section}`;
                          const active = classItem.id === attendance.selectedClassId;
                          return (
                            <button
                              className={`rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${
                                active ? "bg-[#2456E6] text-white shadow-apple-sm" : "text-[#2A3340] hover:bg-[#F7F8FB]"
                              }`}
                              key={classItem.id}
                              onClick={() => {
                                setSelectedClassDisplay(className);
                                setClassPickerOpen(false);
                                attendance.selectClass(classItem.id);
                              }}
                              type="button"
                            >
                              {className}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
            <p className="mt-2 text-[11px] font-medium text-[#86868b]">Last selected class is remembered for this user.</p>
          </div>
          <div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <input
                className="glass-input h-20 min-h-0 w-full self-start text-[14px] font-semibold sm:w-40"
                type="date"
                value={attendance.selectedDate}
                max={attendance.today}
                onChange={(event) => {
                  setCalendarDetailDate(event.target.value);
                  attendance.selectDate(event.target.value);
                }}
                disabled={attendance.loading || attendance.submitting}
              />
              <input
                className="glass-input h-20 min-h-0 w-full self-start text-[14px] font-semibold sm:w-40"
                type="month"
                value={attendance.selectedMonth}
                max={attendance.today.slice(0, 7)}
                onChange={(event) => attendance.selectMonth(event.target.value)}
                disabled={attendance.loading || attendance.submitting}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
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
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,25%)_minmax(0,1fr)]">
      <AttendanceSummary
        total={summary.total}
        present={summary.present}
        absent={summary.absent}
        late={summary.late}
        halfDay={summary.halfDay}
        attended={summary.attended}
        layout="rail"
      />

      <section className="min-w-0 space-y-3 rounded-md border border-[#E2E7EE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#86868b]">Monthly view</p>
            <h2 className="text-[18px] font-semibold text-[#1d1d1f]">{classLabel} attendance calendar</h2>
          </div>
          <p className="text-[12px] text-[#86868b]">Daily attendance snapshot</p>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell) => {
            if (!cell.day) return <div aria-hidden="true" key={cell.key} className="min-h-[42px]" />;

            const dateKey = `${attendance.selectedMonth}-${String(cell.day).padStart(2, "0")}`;
            const day = monthlyByDate.get(dateKey);
            const selected = attendance.selectedDate === dateKey;
            const date = new Date(monthYear, monthNumber - 1, cell.day);
            const isSunday = date.getDay() === 0;
            const isHoliday = isSunday || Boolean((day as { isHoliday?: boolean } | undefined)?.isHoliday);
            const isFuture = dateKey > attendance.today;

            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => {
                  setCalendarDetailDate(dateKey);
                  attendance.selectDate(dateKey);
                }}
                disabled={attendance.loading || attendance.submitting || isFuture}
                className={`group relative min-h-[42px] rounded-lg border px-2 py-1.5 text-left transition hover:shadow-apple-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                  isFuture ? "border-[#E2E7EE] bg-[#F7F8FB] text-[#A0A7B2]" : calendarDayClasses({ selected, marked: Boolean(day), isHoliday })
                }`}
              >
                <span className="block text-[12px] font-semibold leading-none text-[#1d1d1f]">{cell.day}</span>
                <span className="hidden text-[11px] text-[#6e6e73] md:absolute md:left-1/2 md:top-9 md:z-20 md:mt-0 md:w-32 md:-translate-x-1/2 md:space-y-0.5 md:rounded-lg md:border md:border-[#DCE1E8] md:bg-white md:p-2 md:text-left md:shadow-[var(--shadow-menu)] md:group-hover:block md:group-focus-visible:block">
                  {day ? (
                    <>
                      <span className="block font-semibold text-[#1d1d1f]">{day.percentage}%</span>
                      <span className="block">{day.absent} absent</span>
                      {day.halfDay ? <span className="block">{day.halfDay} half-day</span> : null}
                      <span className="block">{day.late} late</span>
                    </>
                  ) : isHoliday ? (
                    <span className="block font-medium text-[#86868b]">{isSunday ? "Sunday" : "Holiday"}</span>
                  ) : (
                    <span className="block text-[#86868b]">Unmarked</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-[#DCE1E8] bg-white px-3 py-2 text-[12px] text-[#6e6e73] md:hidden">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-[#1d1d1f]">{calendarDetailLabel}</span>
            {selectedMonthDay ? <span className="font-semibold text-[#1d1d1f]">{selectedMonthDay.percentage}%</span> : null}
          </div>
          {selectedMonthDay ? (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>{selectedMonthDay.absent} absent</span>
              {selectedMonthDay.halfDay ? <span>{selectedMonthDay.halfDay} half-day</span> : null}
              <span>{selectedMonthDay.late} late</span>
            </div>
          ) : (
            <p className="mt-1">No attendance marked for this day.</p>
          )}
        </div>
      </section>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-[#E2E7EE] bg-white px-5 py-4 text-[13px] shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)] sm:flex-row sm:items-center sm:justify-between">
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
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8" role="status" aria-live="polite">
          <div
            className={`flex max-w-[min(92vw,520px)] items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold shadow-2xl backdrop-blur-xl animate-fade-in ${
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
        <div className="flex w-full justify-end">
          <button
            type="button"
            className="btn-primary min-h-[52px] w-full gap-2 text-[15px] disabled:cursor-not-allowed disabled:opacity-50 sm:w-[232px]"
            onClick={attendance.submitAttendance}
            disabled={submitDisabled}
          >
            {attendance.submitting ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
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
