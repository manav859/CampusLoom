"use client";

import { useEffect, useMemo, useState } from "react";
import { AttendanceList } from "@/components/AttendanceList";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { Button } from "@/components/ui/Button";
import { Modal, ModalCloseButton } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AttendanceListSkeleton } from "@/components/ui/Skeleton";
import { useAttendance } from "@/hooks/useAttendance";
import type { ClassSummary } from "@/lib/api";
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
  if (/nursery|pre|kg|lkg|ukg/i.test(className)) return "Nursery";
  const grade = Number.parseInt(className, 10);
  if (!Number.isFinite(grade)) return "Nursery";
  if (grade <= 5) return "Primary";
  if (grade <= 10) return "Secondary";
  return "Senior Secondary";
}

function groupedClasses(classes: ClassSummary[]) {
  const groups = new Map<string, ClassSummary[]>();
  classes.forEach((classItem) => {
    const group = classGroupName(classItem.name);
    groups.set(group, [...(groups.get(group) ?? []), classItem]);
  });
  return ["Nursery", "Primary", "Secondary", "Senior Secondary"]
    .map((group) => ({ group, classes: groups.get(group) ?? [] }))
    .filter((item) => item.classes.length > 0);
}

function monthInputFromParts(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function dateInMonth(currentDate: string, month: string, today: string) {
  const currentDay = Number(currentDate.slice(8, 10)) || 1;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const nextDate = `${month}-${String(Math.min(currentDay, lastDay)).padStart(2, "0")}`;
  return nextDate > today ? today : nextDate;
}

function monthLabel(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function classOptionLabel(classItem: Pick<ClassSummary, "name" | "section">) {
  return classItem.section ? `${classItem.name}-${classItem.section}` : classItem.name;
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(new Date().getFullYear());
  const [calendarDetailDate, setCalendarDetailDate] = useState("");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const classOptions = attendance.classes;
  const selectedClassRecord = attendance.selectedClass ?? classOptions.find((classItem) => classItem.id === attendance.selectedClassId);
  const firstAvailableClass = classOptions[0] ?? null;
  const classLabel = attendance.selectedClassName || (
    selectedClassRecord
      ? classOptionLabel(selectedClassRecord)
      : attendance.classesLoading ? "Loading classes..." : "No assigned class"
  );
  const hasAssignedClasses = classOptions.length > 0 || Boolean(attendance.selectedClassId);
  const submitDisabled = !attendance.canEdit || attendance.submitting || attendance.loading || attendance.students.length === 0 || !hasAssignedClasses;
  const selectedDateLabel = formatDateShort(attendance.selectedDate);
  const monthlyByDate = useMemo(() => new Map((attendance.monthly?.days ?? []).map((day) => [day.date, day])), [attendance.monthly?.days]);
  const calendarDetailDateKey = calendarDetailDate || attendance.selectedDate;
  const calendarDetailLabel = formatDateShort(calendarDetailDateKey);
  const selectedMonthDay = monthlyByDate.get(calendarDetailDateKey);
  const attendancePending = !attendance.loading && attendance.students.length > 0 && !attendance.marked;
  const summary = attendance.summary;
  const [monthYear = 0, monthNumber = 1] = attendance.selectedMonth.split("-").map(Number);
  const firstWeekday = new Date(monthYear, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(monthYear, monthNumber, 0).getDate();
  const calendarCells = useMemo(
    () => [
      ...Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
      ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 }))
    ],
    [daysInMonth, firstWeekday]
  );
  const classGroups = useMemo(() => groupedClasses(classOptions), [classOptions]);

  useEffect(() => {
    const requestedClassId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("classId") : null;
    if (!requestedClassId || attendance.classesLoading || attendance.selectedClassId === requestedClassId) return;
    if (classOptions.some((classItem) => classItem.id === requestedClassId)) {
      void attendance.selectClass(requestedClassId);
    }
  }, [attendance.classesLoading, attendance.selectedClassId, classOptions, attendance.selectClass]);

  useEffect(() => {
    if (attendance.classesLoading || attendance.selectedClassId || !firstAvailableClass) return;
    void attendance.selectClass(firstAvailableClass.id);
  }, [attendance.classesLoading, attendance.selectedClassId, firstAvailableClass, attendance.selectClass]);

  useEffect(() => {
    if (!attendance.error && !attendance.success) return;
    setShowFeedback(true);
    const timeout = window.setTimeout(() => setShowFeedback(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [attendance.error, attendance.success]);

  useEffect(() => {
    setCalendarDetailDate(attendance.selectedDate);
  }, [attendance.selectedDate]);

  useEffect(() => {
    const [year = new Date().getFullYear()] = attendance.selectedMonth.split("-").map(Number);
    setMonthPickerYear(year);
  }, [attendance.selectedMonth]);

  function selectDisplayDate(date: string) {
    setCalendarDetailDate(date);
    void attendance.selectDate(date);
  }

  function selectDisplayMonth(month: string) {
    const nextDate = dateInMonth(attendance.selectedDate, month, attendance.today);
    setCalendarDetailDate(nextDate);
    void attendance.selectMonth(month);
  }

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
              disabled={!attendance.canEdit || attendance.submitting || attendance.loading || !hasAssignedClasses}
            >
              Reset all present
            </button>
          </div>
        }
      />

      <div className="rounded-md border border-[#E2E7EE] bg-white p-5 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)]">
        <p className="text-[13px] text-[#86868b]">Mark present, late, or absent for any date. Saved days can be reopened and edited.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(260px,380px)_180px_180px]">
          <div className="relative col-span-2 rounded-md border border-[#E2E7EE] bg-white p-2 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)] lg:col-span-1">
            <button
              aria-expanded={classPickerOpen}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#DCE1E8] bg-white px-3 py-2.5 text-left text-[15px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#AAB4C2] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={(!hasAssignedClasses && attendance.classesLoading) || attendance.submitting}
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
                {classOptions.length === 0 || classGroups.length === 0 ? (
                  <div className="rounded-xl bg-[#F7F8FB] px-3 py-3 text-[13px] font-semibold text-[#86868b]">No assigned class</div>
                ) : (
                  classGroups.map((item) => (
                    <div key={item.group} className="py-1">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#86868b]">{item.group}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {item.classes.map((classItem) => {
                          const className = classOptionLabel(classItem);
                          const active = classItem.id === attendance.selectedClassId;
                          return (
                            <button
                              className={`rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${
                                active ? "bg-[#2456E6] text-white shadow-apple-sm" : "text-[#2A3340] hover:bg-[#F7F8FB]"
                              }`}
                              key={classItem.id}
                              onClick={() => {
                                setClassPickerOpen(false);
                                attendance.selectClass(classItem.id, classItem);
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

          {(hasAssignedClasses || attendance.classesLoading) ? (
            <>
          <div className="relative">
            <button
              className="flex min-h-[72px] w-full items-center justify-between gap-2 rounded-md border border-[#E2E7EE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)] sm:px-4 sm:text-[14px]"
              disabled={!hasAssignedClasses || attendance.submitting}
              onClick={() => {
                setDatePickerOpen((open) => !open);
                setMonthPickerOpen(false);
              }}
              type="button"
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#86868b]">Day</span>
                <span className="mt-0.5 block truncate">{selectedDateLabel}</span>
              </span>
              <svg className="h-4 w-4 text-[#5A6573]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
              </svg>
            </button>
            {datePickerOpen ? (
              <div className="absolute left-0 top-[80px] z-30 w-72 rounded-2xl border border-[#DCE1E8] bg-white p-3 shadow-[var(--shadow-menu)]">
                <div className="mb-3 flex items-center justify-between">
                  <button className="rounded-full p-2 text-[#5A6573] hover:bg-[#F7F8FB]" onClick={() => selectDisplayMonth(monthInputFromParts(monthYear, monthNumber - 2))} type="button" aria-label="Previous month">&lt;</button>
                  <span className="text-[13px] font-bold text-[#1d1d1f]">{monthLabel(attendance.selectedMonth)}</span>
                  <button
                    className="rounded-full p-2 text-[#5A6573] hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={monthInputFromParts(monthYear, monthNumber) > attendance.today.slice(0, 7)}
                    onClick={() => selectDisplayMonth(monthInputFromParts(monthYear, monthNumber))}
                    type="button"
                    aria-label="Next month"
                  >
                    &gt;
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#86868b]">
                  {["S", "M", "T", "W", "T", "F", "S"].map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {calendarCells.map((cell) => {
                    if (!cell.day) return <span aria-hidden="true" className="h-8" key={cell.key} />;
                    const dateKey = `${attendance.selectedMonth}-${String(cell.day).padStart(2, "0")}`;
                    const isFuture = dateKey > attendance.today;
                    const selected = attendance.selectedDate === dateKey;
                    return (
                      <button
                        className={`h-8 rounded-lg text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${selected ? "bg-[#2456E6] text-white" : "text-[#2A3340] hover:bg-[#F7F8FB]"}`}
                        disabled={isFuture}
                        key={cell.key}
                        onClick={() => {
                          setDatePickerOpen(false);
                          selectDisplayDate(dateKey);
                        }}
                        type="button"
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              className="flex min-h-[72px] w-full items-center justify-between gap-2 rounded-md border border-[#E2E7EE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)] sm:px-4 sm:text-[14px]"
              disabled={!hasAssignedClasses || attendance.submitting}
              onClick={() => {
                setMonthPickerOpen((open) => !open);
                setDatePickerOpen(false);
              }}
              type="button"
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#86868b]">Month</span>
                <span className="mt-0.5 block truncate">{monthLabel(attendance.selectedMonth)}</span>
              </span>
              <svg className="h-4 w-4 text-[#5A6573]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
              </svg>
            </button>
            {monthPickerOpen ? (
              <div className="absolute left-0 top-[80px] z-30 w-72 rounded-2xl border border-[#DCE1E8] bg-white p-3 shadow-[var(--shadow-menu)]">
                <div className="mb-3 flex items-center justify-between">
                  <button className="rounded-full p-2 text-[#5A6573] hover:bg-[#F7F8FB]" onClick={() => setMonthPickerYear((year) => year - 1)} type="button" aria-label="Previous year">&lt;</button>
                  <span className="text-[13px] font-bold text-[#1d1d1f]">{monthPickerYear}</span>
                  <button className="rounded-full p-2 text-[#5A6573] hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-40" disabled={monthPickerYear >= Number(attendance.today.slice(0, 4))} onClick={() => setMonthPickerYear((year) => year + 1)} type="button" aria-label="Next year">&gt;</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }, (_, index) => {
                    const value = monthInputFromParts(monthPickerYear, index);
                    const disabled = value > attendance.today.slice(0, 7);
                    const selected = attendance.selectedMonth === value;
                    return (
                      <button
                        className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${selected ? "bg-[#2456E6] text-white" : "bg-[#F7F8FB] text-[#2A3340] hover:bg-[#E8ECF3]"}`}
                        disabled={disabled}
                        key={value}
                        onClick={() => {
                          setMonthPickerOpen(false);
                          selectDisplayMonth(value);
                        }}
                        type="button"
                      >
                        {new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(monthPickerYear, index, 1))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
            </>
          ) : null}
        </div>
      </div>

      {!attendance.classesLoading && !hasAssignedClasses ? (
        <div className="rounded-md border border-[#E2E7EE] bg-white px-5 py-10 text-center shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)]">
          <p className="text-[16px] font-semibold text-[#1d1d1f]">No assigned class</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[#6e6e73]">
            Attendance can be marked after a class is assigned to this account.
          </p>
        </div>
      ) : (
        <>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,25%)_minmax(0,1fr)]">
        <AttendanceSummary
          total={summary.total}
          present={summary.present}
          absent={summary.absent}
          late={summary.late}
          halfDay={summary.halfDay}
          attended={summary.attended}
          layout="rail"
          pending={attendancePending}
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
                  selectDisplayDate(dateKey);
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
        </>
      )}
    </div>
  );
}
