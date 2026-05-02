"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function monthInputFromDate(date: string) {
  return date.slice(0, 7);
}

function toMarkStatus(status: string): AttendanceMarkStatus {
  if (status === "ABSENT") return "ABSENT";
  if (status === "LATE") return "LATE";
  return "PRESENT";
}

export function useAttendance() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayAsDateInput());
  const [selectedMonth, setSelectedMonth] = useState(monthInputFromDate(todayAsDateInput()));
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [monthly, setMonthly] = useState<ClassMonthlyAttendance | null>(null);
  const [marked, setMarked] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedClass = classes.find((classItem) => classItem.id === selectedClassId);

  const summary = useMemo(
    () => ({
      total: students.length,
      present: students.filter((student) => student.status === "PRESENT").length,
      absent: students.filter((student) => student.status === "ABSENT").length,
      late: students.filter((student) => student.status === "LATE").length
    }),
    [students]
  );

  const loadMonth = useCallback(async (classId: string, month: string) => {
    if (!classId) {
      setMonthly(null);
      return;
    }
    const result = await attendanceApi.classMonth(classId, month);
    setMonthly(result);
  }, []);

  const loadClass = useCallback(async (classId: string, date: string) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const roster = await attendanceApi.roster(classId, date);

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
      if (roster.session) setSuccess("Attendance loaded. You can edit and save changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load attendance");
      setStudents([]);
      setMarked(false);
      setCanEdit(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setError("");

      try {
        const classList = await classesApi.list();
        if (cancelled) return;
        setClasses(classList);

        const firstClassId = classList[0]?.id ?? "";
        setSelectedClassId(firstClassId);
        if (firstClassId) {
          await Promise.all([loadClass(firstClassId, selectedDate), loadMonth(firstClassId, selectedMonth)]);
        }
        else {
          setStudents([]);
          setMarked(false);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load classes");
        setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [loadClass, loadMonth]);

  const selectClass = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId);
      if (classId) await Promise.all([loadClass(classId, selectedDate), loadMonth(classId, selectedMonth)]);
      else {
        setStudents([]);
        setMarked(false);
      }
    },
    [loadClass, loadMonth, selectedDate, selectedMonth]
  );

  const selectDate = useCallback(async (date: string) => {
    setSelectedDate(date);
    setSelectedMonth(monthInputFromDate(date));
    if (selectedClassId) await Promise.all([loadClass(selectedClassId, date), loadMonth(selectedClassId, monthInputFromDate(date))]);
  }, [loadClass, loadMonth, selectedClassId]);

  const selectMonth = useCallback(async (month: string) => {
    setSelectedMonth(month);
    if (selectedClassId) await loadMonth(selectedClassId, month);
  }, [loadMonth, selectedClassId]);

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
        const next = student.status === "PRESENT" ? "LATE" : student.status === "LATE" ? "ABSENT" : "PRESENT";
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
    selectedDate,
    selectedMonth,
    students,
    monthly,
    marked,
    canEdit,
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
