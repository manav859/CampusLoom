"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attendanceApi, classesApi, type AttendanceMarkStatus, type ClassMonthlyAttendance, type ClassSummary } from "@/lib/api";

export type AttendanceStudent = {
  id: string;
  name: string;
  rollNumber: number | null;
  status: AttendanceMarkStatus;
};

function todayAsDateInput() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInput(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isMonthInput(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return year >= 2000 && month >= 1 && month <= 12;
}

function monthInputFromDate(date: string) {
  return date.slice(0, 7);
}

function dateInMonth(currentDate: string, month: string, _today: string) {
  const currentDay = Number(currentDate.slice(8, 10)) || 1;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const nextDate = `${month}-${String(Math.min(currentDay, lastDay)).padStart(2, "0")}`;
  return nextDate;
}

function readInitialDate() {
  const today = todayAsDateInput();
  if (typeof window === "undefined") return today;

  const params = new URLSearchParams(window.location.search);
  const date = params.get("date");
  if (isDateInput(date)) return date!;

  const month = params.get("month");
  if (isMonthInput(month)) return dateInMonth(today, month!, today);

  return today;
}

function readInitialClassId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("classId") ?? "";
}

function readRememberedClassId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(attendanceClassStorageKey()) ?? "";
}

function readBootstrapClassId() {
  return readInitialClassId() || readRememberedClassId();
}

function classOptionLabel(classItem: Pick<ClassSummary, "name" | "section">) {
  return classItem.section ? `${classItem.name}-${classItem.section}` : classItem.name;
}

function nextClassName(current: string, incoming: string | undefined) {
  if (current && current !== "Selected class") return current;
  return incoming || current || "Selected class";
}

function updateAttendanceUrl(classId: string, date: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (classId) url.searchParams.set("classId", classId);
  else url.searchParams.delete("classId");
  url.searchParams.set("date", date);
  url.searchParams.set("month", monthInputFromDate(date));
  window.history.replaceState(window.history.state, "", url);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Request timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function classesFromDailyRows(rows: Awaited<ReturnType<typeof attendanceApi.daily>>): ClassSummary[] {
  const byId = new Map<string, ClassSummary>();
  rows.forEach((row) => {
    const [name = row.className, section = ""] = row.className.split("-");
    byId.set(row.classId, { id: row.classId, name, section, academicYear: "" });
  });
  return [...byId.values()];
}

function toMarkStatus(status: string): AttendanceMarkStatus {
  if (status === "ABSENT") return "ABSENT";
  if (status === "LATE") return "LATE";
  if (status === "HALF_DAY") return "HALF_DAY";
  return "PRESENT";
}

function attendanceValue(status: AttendanceMarkStatus) {
  if (status === "ABSENT") return 0;
  if (status === "HALF_DAY") return 0.5;
  return 1;
}

function attendanceClassStorageKey() {
  if (typeof window === "undefined") return "smartshala.attendance.lastClass";
  try {
    const user = JSON.parse(window.localStorage.getItem("smartshala.user") || "{}") as { id?: string };
    return user.id ? `smartshala.attendance.lastClass.${user.id}` : "smartshala.attendance.lastClass";
  } catch {
    return "smartshala.attendance.lastClass";
  }
}

export function useAttendance() {
  const initialDate = readInitialDate();
  const initialClassId = readBootstrapClassId();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedClassName, setSelectedClassName] = useState(initialClassId ? "Selected class" : "");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedMonth, setSelectedMonth] = useState(monthInputFromDate(initialDate));
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [monthly, setMonthly] = useState<ClassMonthlyAttendance | null>(null);
  const [marked, setMarked] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState("");
  const [classesLoading, setClassesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const loadRequestId = useRef(0);

  const selectedClass = classes.find((classItem) => classItem.id === selectedClassId);
  const displayClassName = selectedClass ? classOptionLabel(selectedClass) : selectedClassName;

  const summary = useMemo(
    () => ({
      total: students.length,
      present: students.filter((student) => student.status === "PRESENT").length,
      absent: students.filter((student) => student.status === "ABSENT").length,
      late: students.filter((student) => student.status === "LATE").length,
      halfDay: students.filter((student) => student.status === "HALF_DAY").length,
      attended: students.reduce((sum, student) => sum + attendanceValue(student.status), 0)
    }),
    [students]
  );

  const loadMonth = useCallback(async (classId: string, month: string, requestId = loadRequestId.current) => {
    if (!classId) {
      setMonthly(null);
      return;
    }
    try {
      const result = await attendanceApi.classMonth(classId, month);
      if (requestId !== loadRequestId.current) return;
      setMonthly(result);
      setSelectedClassName((current) => nextClassName(current, result.className));
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      setMonthly(null);
      setError(err instanceof Error ? err.message : "Unable to load monthly attendance");
    }
  }, []);

  const loadClass = useCallback(async (classId: string, date: string, requestId = loadRequestId.current) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const roster = await attendanceApi.roster(classId, date);
      if (requestId !== loadRequestId.current) return;

      setSelectedClassName((current) => nextClassName(current, roster.className));
      setStudents(
        roster.students.map((student) => ({
          id: student.id,
          name: student.fullName,
          rollNumber: student.rollNumber,
          status: toMarkStatus(student.savedStatus ?? student.defaultStatus ?? "PRESENT")
        }))
      );
      setMarked(Boolean(roster.session));
      setCanEdit(roster.canEdit);
      setIsHoliday(Boolean(roster.isHoliday));
      setHolidayReason(roster.holidayReason ?? "");
      if (roster.session) setSuccess("Attendance loaded. You can edit and save changes.");
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      setError(err instanceof Error ? err.message : "Unable to load attendance");
      setStudents([]);
      setMarked(false);
      setCanEdit(false);
      setIsHoliday(false);
      setHolidayReason("");
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setClassesLoading(true);
      setLoading(false);
      setError("");

      try {
        const initialDate = readInitialDate();
        const initialMonth = monthInputFromDate(initialDate);
        const requestedClassId = readInitialClassId();
        const rememberedClassId = readRememberedClassId();
        const bootstrapClassId = requestedClassId || rememberedClassId;
        let activeRequestId = loadRequestId.current;

        if (bootstrapClassId) {
          activeRequestId = loadRequestId.current + 1;
          loadRequestId.current = activeRequestId;
          setSelectedClassId(bootstrapClassId);
          setSelectedClassName("Selected class");
          setSelectedDate(initialDate);
          setSelectedMonth(initialMonth);
          updateAttendanceUrl(bootstrapClassId, initialDate);
          void Promise.all([
            loadClass(bootstrapClassId, initialDate, activeRequestId),
            loadMonth(bootstrapClassId, initialMonth, activeRequestId)
          ]);
        }

        const [classResult, dailyResult] = await Promise.allSettled([
          withTimeout(classesApi.list(), 6000),
          withTimeout(attendanceApi.daily(), 6000)
        ]);
        if (cancelled) return;

        const classList = classResult.status === "fulfilled" ? classResult.value : [];
        const dailyRows = dailyResult.status === "fulfilled" ? dailyResult.value : [];
        const fallbackClasses = classesFromDailyRows(dailyRows);
        const mergedClasses = new Map<string, ClassSummary>();
        [...classList, ...fallbackClasses].forEach((classItem) => mergedClasses.set(classItem.id, classItem));
        const availableClasses = [...mergedClasses.values()];
        setClasses(availableClasses);

        const requestedClass = availableClasses.find((classItem) => classItem.id === requestedClassId);
        const rememberedClass = availableClasses.find((classItem) => classItem.id === rememberedClassId);
        const bootstrapClass = availableClasses.find((classItem) => classItem.id === bootstrapClassId);
        const firstClass =
          requestedClass ??
          rememberedClass ??
          availableClasses[0] ??
          null;

        if (bootstrapClassId) {
          if (bootstrapClass) setSelectedClassName(classOptionLabel(bootstrapClass));
          if (!requestedClassId && !bootstrapClass && firstClass) {
            const requestId = loadRequestId.current + 1;
            loadRequestId.current = requestId;
            setSelectedClassId(firstClass.id);
            setSelectedClassName(classOptionLabel(firstClass));
            updateAttendanceUrl(firstClass.id, initialDate);
            void Promise.all([loadClass(firstClass.id, initialDate, requestId), loadMonth(firstClass.id, initialMonth, requestId)]);
          }
          return;
        }

        const firstClassId = firstClass?.id ?? "";
        if (firstClassId) {
          const requestId = activeRequestId + 1;
          loadRequestId.current = requestId;
          setSelectedClassId(firstClassId);
          setSelectedClassName(firstClass ? classOptionLabel(firstClass) : "Selected class");
          setSelectedDate(initialDate);
          setSelectedMonth(initialMonth);
          updateAttendanceUrl(firstClassId, initialDate);
          void Promise.all([loadClass(firstClassId, initialDate, requestId), loadMonth(firstClassId, initialMonth, requestId)]);
        }
        else {
          setStudents([]);
          setMarked(false);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load classes");
        setClasses([]);
        setLoading(false);
      } finally {
        if (!cancelled) setClassesLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [loadClass, loadMonth]);

  const selectClass = useCallback(
    async (classId: string, classItem?: ClassSummary) => {
      const requestId = loadRequestId.current + 1;
      loadRequestId.current = requestId;
      setSelectedClassId(classId);
      const knownClass = classItem ?? classes.find((item) => item.id === classId);
      setSelectedClassName(knownClass ? classOptionLabel(knownClass) : classId ? "Selected class" : "");
      if (classId) window.localStorage.setItem(attendanceClassStorageKey(), classId);
      updateAttendanceUrl(classId, selectedDate);
      if (classId) await Promise.all([loadClass(classId, selectedDate, requestId), loadMonth(classId, selectedMonth, requestId)]);
      else {
        setStudents([]);
        setMarked(false);
        setMonthly(null);
      }
    },
    [classes, loadClass, loadMonth, selectedDate, selectedMonth]
  );

  const selectDate = useCallback(async (date: string) => {
    if (!isDateInput(date)) return;
    const nextDate = date;
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    const month = monthInputFromDate(nextDate);
    setSelectedDate(nextDate);
    setSelectedMonth(month);
    updateAttendanceUrl(selectedClassId, nextDate);
    if (selectedClassId) await Promise.all([loadClass(selectedClassId, nextDate, requestId), loadMonth(selectedClassId, month, requestId)]);
  }, [loadClass, loadMonth, selectedClassId]);

  const selectMonth = useCallback(async (month: string) => {
    if (!isMonthInput(month)) return;
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    const nextDate = dateInMonth(selectedDate, month, todayAsDateInput());
    setSelectedMonth(month);
    setSelectedDate(nextDate);
    updateAttendanceUrl(selectedClassId, nextDate);
    if (selectedClassId) await Promise.all([loadClass(selectedClassId, nextDate, requestId), loadMonth(selectedClassId, month, requestId)]);
  }, [loadClass, loadMonth, selectedClassId, selectedDate]);

  useEffect(() => {
    if (!selectedClass) return;
    setSelectedClassName(classOptionLabel(selectedClass));
  }, [selectedClass]);

  const setStudentStatus = useCallback((studentId: string, status: AttendanceMarkStatus) => {
    if (!canEdit || submitting) return;
    setStudents((items) =>
      items.map((student) =>
        student.id === studentId
          ? {
              ...student,
              status
            }
        : student
      )
    );
  }, [canEdit, submitting]);

  const toggleStudent = useCallback((studentId: string) => {
    if (!canEdit || submitting) return;
    setStudents((items) =>
      items.map((student) => {
        if (student.id !== studentId) return student;
        const next =
          student.status === "PRESENT"
            ? "LATE"
            : student.status === "LATE"
              ? "HALF_DAY"
              : student.status === "HALF_DAY"
                ? "ABSENT"
                : "PRESENT";
        return { ...student, status: next };
      })
    );
  }, [canEdit, submitting]);

  const markAllPresent = useCallback(() => {
    if (!canEdit || submitting) return;
    setStudents((items) => items.map((student) => ({ ...student, status: "PRESENT" })));
  }, [canEdit, submitting]);

  const submitAttendance = useCallback(async () => {
    if (!selectedClassId || !canEdit || submitting || students.length === 0) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await attendanceApi.mark({
        classId: selectedClassId,
        date: selectedDate,
        records: students.map((student) => ({
          studentId: student.id,
          status: student.status
        }))
      });
      setMarked(true);
      setSuccess(marked ? "Attendance updated." : "Attendance submitted.");
      await loadMonth(selectedClassId, selectedMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attendance submission failed");
    } finally {
      setSubmitting(false);
    }
  }, [canEdit, loadMonth, marked, selectedClassId, selectedDate, selectedMonth, students, submitting]);

  return {
    classes,
    selectedClass,
    selectedClassId,
    selectedClassName: displayClassName,
    selectedDate,
    selectedMonth,
    students,
    monthly,
    marked,
    canEdit,
    isHoliday,
    holidayReason,
    classesLoading,
    loading,
    submitting,
    error,
    success,
    summary,
    today: todayAsDateInput(),
    selectClass,
    selectDate,
    selectMonth,
    toggleStudent,
    setStudentStatus,
    markAllPresent,
    submitAttendance
  };
}
