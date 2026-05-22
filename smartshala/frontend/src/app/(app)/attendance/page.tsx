"use client";

import { useEffect, useState, useRef } from "react";
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

  // Dropdown states
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  // Custom calendar picker navigation states
  const [datePickerYear, setDatePickerYear] = useState(2026);
  const [datePickerMonth, setDatePickerMonth] = useState(4); // 0-indexed, default May (4)
  const [monthPickerYear, setMonthPickerYear] = useState(2026);

  // Refs for closing on outside click
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (attendance.selectedDate) {
      const [y, m] = attendance.selectedDate.split("-").map(Number);
      if (y && m) {
        setDatePickerYear(y);
        setDatePickerMonth(m - 1);
      }
    }
  }, [attendance.selectedDate]);

  useEffect(() => {
    if (attendance.selectedMonth) {
      const [y] = attendance.selectedMonth.split("-").map(Number);
      if (y) {
        setMonthPickerYear(y);
      }
    }
  }, [attendance.selectedMonth]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (classDropdownRef.current && !classDropdownRef.current.contains(target)) {
        setClassDropdownOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(target)) {
        setDatePickerOpen(false);
      }
      if (monthPickerRef.current && !monthPickerRef.current.contains(target)) {
        setMonthPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}-${m}-${y}`;
  };

  const formatDisplayMonth = (monthStr: string) => {
    if (!monthStr) return "";
    const [y, m] = monthStr.split("-");
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const mIndex = Number(m) - 1;
    return `${monthNames[mIndex] || ""}, ${y}`;
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Attendance"
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
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {/* Class Dropdown */}
          <div ref={classDropdownRef} className="relative w-full">
            <button
              type="button"
              onClick={() => {
                setClassDropdownOpen(!classDropdownOpen);
                setDatePickerOpen(false);
                setMonthPickerOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between rounded-xl border border-[#DCE1E8] bg-white px-3.5 text-[15px] font-semibold text-[#1d1d1f] shadow-apple-sm transition hover:bg-[#f5f5f7]/40 focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10 outline-none"
              disabled={attendance.loading || attendance.submitting}
            >
              <span className="truncate">{classLabel}</span>
              <svg className={`h-4 w-4 shrink-0 text-[#86868b] transition-transform duration-200 ${classDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {classDropdownOpen && (
              <div className="absolute left-0 z-30 mt-2 w-full min-w-[220px] rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white shadow-2xl animate-in fade-in slide-in-from-top-1">
                <div className="p-2 border-b border-[rgba(0,0,0,0.06)]">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </span>
                    <input
                      ref={(el) => { if (el && classDropdownOpen) el.focus(); }}
                      className="w-full rounded-xl border border-[#DCE1E8] bg-white pl-9 pr-3 py-2 text-[13px] font-semibold outline-none focus:border-[#2456E6]"
                      disabled={attendance.loading || attendance.submitting}
                      onChange={(event) => setClassSearch(event.target.value)}
                      placeholder="Search class..."
                      value={classSearch}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                  {attendance.classes.length === 0 ? (
                    <p className="p-3 text-center text-[13px] text-[#86868b]">No assigned class</p>
                  ) : filteredClassGroups.length === 0 ? (
                    <p className="p-3 text-center text-[13px] text-[#86868b]">No classes match "{classSearch}"</p>
                  ) : (
                    filteredClassGroups.map((item) => (
                      <div key={item.group} className="space-y-0.5">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-[#86868b] uppercase tracking-[0.08em] bg-[#f5f5f7]/50 rounded-lg">
                          {item.group}
                        </div>
                        {item.classes.map((classItem) => {
                          const isSelected = attendance.selectedClassId === classItem.id;
                          return (
                            <button
                              key={classItem.id}
                              type="button"
                              onClick={() => {
                                attendance.selectClass(classItem.id);
                                setClassDropdownOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] font-semibold transition ${
                                isSelected
                                  ? "bg-[#2456E6] text-white hover:bg-[#2456E6] hover:text-white"
                                  : "text-[#1d1d1f] hover:bg-[#2456E6]/10 hover:text-[#2456E6]"
                              }`}
                            >
                              <span>{classItem.name}-{classItem.section}</span>
                              {isSelected && (
                                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <p className="mt-1.5 px-1 text-[11px] font-medium text-[#86868b]">Last selected class is remembered for this user.</p>
          </div>

          {/* Custom DatePicker */}
          <div ref={datePickerRef} className="relative w-full">
            <button
              type="button"
              onClick={() => {
                setDatePickerOpen(!datePickerOpen);
                setMonthPickerOpen(false);
                setClassDropdownOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between rounded-xl border border-[#DCE1E8] bg-white px-3.5 text-[15px] font-semibold text-[#1d1d1f] shadow-apple-sm transition hover:bg-[#f5f5f7]/40 focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10 outline-none"
              disabled={attendance.loading || attendance.submitting}
            >
              <span>{formatDisplayDate(attendance.selectedDate)}</span>
              <svg className="h-4.5 w-4.5 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </button>

            {datePickerOpen && (
              <div className="absolute right-0 z-30 mt-2 w-[280px] rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-3 shadow-2xl animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[rgba(0,0,0,0.06)]">
                  <span className="text-[14px] font-bold text-[#1d1d1f]">
                    {new Date(datePickerYear, datePickerMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (datePickerMonth === 0) {
                          setDatePickerMonth(11);
                          setDatePickerYear(datePickerYear - 1);
                        } else {
                          setDatePickerMonth(datePickerMonth - 1);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)] text-[#5A6573]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (datePickerMonth === 11) {
                          setDatePickerMonth(0);
                          setDatePickerYear(datePickerYear + 1);
                        } else {
                          setDatePickerMonth(datePickerMonth + 1);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)] text-[#5A6573]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#86868b] tracking-wider mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: new Date(datePickerYear, datePickerMonth, 1).getDay() }).map((_, i) => (
                    <div key={`blank-${i}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: new Date(datePickerYear, datePickerMonth + 1, 0).getDate() }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${datePickerYear}-${String(datePickerMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isSelected = attendance.selectedDate === dateStr;
                    const isToday = new Date().toDateString() === new Date(datePickerYear, datePickerMonth, day).toDateString();

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          attendance.selectDate(dateStr);
                          setDatePickerOpen(false);
                        }}
                        className={`aspect-square w-full rounded-lg text-[13px] font-semibold flex items-center justify-center transition ${
                          isSelected
                            ? "bg-[#2456E6] text-white hover:bg-[#2456E6]"
                            : isToday
                              ? "bg-[#2456E6]/10 text-[#2456E6] hover:bg-[#2456E6]/25"
                              : "text-[#1d1d1f] hover:bg-[rgba(0,0,0,0.04)]"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 pt-2 border-t border-[rgba(0,0,0,0.06)] flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                      attendance.selectDate(todayStr);
                      setDatePickerOpen(false);
                    }}
                    className="text-[12px] font-bold text-[#2456E6] hover:underline px-2 py-1"
                  >
                    Today
                  </button>
                </div>
              </div>
            )}
            <p className="mt-1.5 px-1 text-[11px] font-medium text-[#86868b] hidden sm:block">&nbsp;</p>
          </div>

          {/* Custom MonthPicker */}
          <div ref={monthPickerRef} className="relative w-full">
            <button
              type="button"
              onClick={() => {
                setMonthPickerOpen(!monthPickerOpen);
                setDatePickerOpen(false);
                setClassDropdownOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between rounded-xl border border-[#DCE1E8] bg-white px-3.5 text-[15px] font-semibold text-[#1d1d1f] shadow-apple-sm transition hover:bg-[#f5f5f7]/40 focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10 outline-none"
              disabled={attendance.loading || attendance.submitting}
            >
              <span>{formatDisplayMonth(attendance.selectedMonth)}</span>
              <svg className="h-4.5 w-4.5 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </button>

            {monthPickerOpen && (
              <div className="absolute right-0 z-30 mt-2 w-[240px] rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-3 shadow-2xl animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[rgba(0,0,0,0.06)]">
                  <span className="text-[14px] font-bold text-[#1d1d1f]">{monthPickerYear}</span>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setMonthPickerYear(monthPickerYear - 1)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)] text-[#5A6573]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthPickerYear(monthPickerYear + 1)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)] text-[#5A6573]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((mName, index) => {
                    const mVal = String(index + 1).padStart(2, "0");
                    const monthStr = `${monthPickerYear}-${mVal}`;
                    const isSelected = attendance.selectedMonth === monthStr;
                    const isCurrentMonth = new Date().getFullYear() === monthPickerYear && new Date().getMonth() === index;

                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => {
                          attendance.selectMonth(monthStr);
                          setMonthPickerOpen(false);
                        }}
                        className={`py-2 px-1 rounded-xl text-[13px] font-semibold text-center transition ${
                          isSelected
                            ? "bg-[#2456E6] text-white hover:bg-[#2456E6] hover:text-white"
                            : isCurrentMonth
                              ? "bg-[#2456E6]/10 text-[#2456E6] hover:bg-[#2456E6]/25"
                              : "text-[#1d1d1f] hover:bg-[rgba(0,0,0,0.04)]"
                        }`}
                      >
                        {mName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="mt-1.5 px-1 text-[11px] font-medium text-[#86868b] hidden sm:block">&nbsp;</p>
          </div>
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
          <p className="text-[13px] text-[#86868b]">Hover on any day to see details or tap to load date.</p>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarCells.map((cell) => {
            if (!cell.day) return <div aria-hidden="true" key={cell.key} className="aspect-square w-full" />;

            const dateKey = `${attendance.selectedMonth}-${String(cell.day).padStart(2, "0")}`;
            const day = monthlyByDate.get(dateKey);
            const selected = attendance.selectedDate === dateKey;
            const date = new Date(monthYear, monthNumber - 1, cell.day);
            const isSunday = date.getDay() === 0;
            const isHoliday = isSunday || Boolean((day as { isHoliday?: boolean } | undefined)?.isHoliday);

            return (
              <div key={cell.key} className="relative group flex items-center justify-center">
                <button
                  type="button"
                  key={cell.key}
                  onClick={() => attendance.selectDate(dateKey)}
                  disabled={attendance.loading || attendance.submitting}
                  className={`aspect-square w-full rounded-xl border flex flex-col items-center justify-center text-center transition hover:shadow-apple-sm disabled:cursor-not-allowed disabled:opacity-60 text-[14px] font-semibold ${
                    calendarDayClasses({ selected, marked: Boolean(day), isHoliday })
                  }`}
                >
                  {cell.day}
                </button>

                {/* Hover Tooltip Details */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2.5 hidden w-44 -translate-x-1/2 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/95 p-3 shadow-xl backdrop-blur-md transition-all duration-200 group-hover:block animate-in fade-in slide-in-from-bottom-1">
                  <div className="text-[12px] font-bold text-[#1d1d1f] mb-1 pb-1 border-b border-[rgba(0,0,0,0.04)]">
                    {cell.day} {new Date(monthYear, monthNumber - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </div>
                  {day ? (
                    <div className="space-y-1 text-[11px] text-[#6e6e73]">
                      <div className="flex justify-between">
                        <span>Attendance:</span>
                        <span className="font-bold text-[#2456E6]">{day.percentage}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Absent:</span>
                        <span className="font-semibold text-[#d70015]">{day.absent}</span>
                      </div>
                      {day.halfDay ? (
                        <div className="flex justify-between">
                          <span>Half-day:</span>
                          <span className="font-semibold text-[#7c3aed]">{day.halfDay}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between">
                        <span>Late:</span>
                        <span className="font-semibold text-[#c93400]">{day.late}</span>
                      </div>
                    </div>
                  ) : isHoliday ? (
                    <span className="text-[11px] font-medium text-[#86868b]">{isSunday ? "Sunday (Holiday)" : "Holiday"}</span>
                  ) : (
                    <span className="text-[11px] font-medium text-[#86868b]">Unmarked day</span>
                  )}
                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
                </div>
              </div>
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
        <div className="mx-auto flex w-full justify-end">
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
