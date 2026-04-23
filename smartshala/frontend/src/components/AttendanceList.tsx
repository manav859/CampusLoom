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
      <div className="rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] px-4 py-12 text-center text-[13px] text-[#86868b] shadow-apple-sm">
        No students found for this class.
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-32" role="list" aria-label="Students">
      {students.map((student) => (
        <div key={student.id} role="listitem">
          <StudentRow student={student} onToggle={onToggle} disabled={disabled} />
        </div>
      ))}
    </div>
  );
}
