"use client";

import type { AttendanceStudent } from "@/hooks/useAttendance";
import { StudentRow } from "./StudentRow";

type AttendanceListProps = {
  students: AttendanceStudent[];
  onToggle: (studentId: string) => void;
  disabled?: boolean;
};

export function AttendanceList({ students, onToggle, disabled = false }: AttendanceListProps) {
  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-panel px-4 py-10 text-center text-sm text-neutral-600">
        No students found for this class.
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-28">
      {students.map((student) => (
        <StudentRow key={student.id} student={student} onToggle={onToggle} disabled={disabled} />
      ))}
    </div>
  );
}
