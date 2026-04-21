"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { attendanceApi, classesApi, type AttendanceMarkStatus, type ClassSummary } from "@/lib/api";

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

function toMarkStatus(status: string): AttendanceMarkStatus {
  return status === "ABSENT" ? "ABSENT" : "PRESENT";
}

export function useAttendance() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [marked, setMarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedClass = classes.find((classItem) => classItem.id === selectedClassId);

  const summary = useMemo(
    () => ({
      total: students.length,
      present: students.filter((student) => student.status === "PRESENT").length,
      absent: students.filter((student) => student.status === "ABSENT").length
    }),
    [students]
  );

  const loadClass = useCallback(async (classId: string) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const [classStudents, todayAttendance] = await Promise.all([classesApi.students(classId), attendanceApi.classToday(classId)]);
      const attendanceByStudent = new Map(todayAttendance.attendance.map((item) => [item.studentId, item.status]));

      setStudents(
        classStudents.map((student) => ({
          id: student.id,
          name: student.fullName,
          rollNumber: student.rollNumber,
          status: toMarkStatus(attendanceByStudent.get(student.id) ?? "PRESENT")
        }))
      );
      setMarked(todayAttendance.marked);
      if (todayAttendance.marked) setSuccess("Attendance already submitted for today.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load attendance");
      setStudents([]);
      setMarked(false);
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
        if (firstClassId) await loadClass(firstClassId);
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
  }, [loadClass]);

  async function selectClass(classId: string) {
    setSelectedClassId(classId);
    await loadClass(classId);
  }

  function toggleStudent(studentId: string) {
    if (marked || submitting) return;
    setStudents((items) =>
      items.map((student) =>
        student.id === studentId
          ? {
              ...student,
              status: student.status === "PRESENT" ? "ABSENT" : "PRESENT"
            }
          : student
      )
    );
  }

  function markAllPresent() {
    if (marked || submitting) return;
    setStudents((items) => items.map((student) => ({ ...student, status: "PRESENT" })));
  }

  async function submitAttendance() {
    if (!selectedClassId || marked || submitting || students.length === 0) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await attendanceApi.mark({
        classId: selectedClassId,
        date: new Date().toISOString(),
        records: students.map((student) => ({
          studentId: student.id,
          status: student.status
        }))
      });
      setMarked(true);
      setSuccess("Attendance submitted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attendance submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    classes,
    selectedClass,
    selectedClassId,
    students,
    marked,
    loading,
    submitting,
    error,
    success,
    summary,
    today: todayAsDateInput(),
    selectClass,
    toggleStudent,
    markAllPresent,
    submitAttendance
  };
}
