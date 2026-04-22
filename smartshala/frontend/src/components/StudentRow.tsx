"use client";

import { memo } from "react";
import type { AttendanceStudent } from "@/hooks/useAttendance";

type StudentRowProps = {
  student: AttendanceStudent;
  onToggle: (studentId: string) => void;
  disabled?: boolean;
};

function StudentRowComponent({ student, onToggle, disabled = false }: StudentRowProps) {
  const isAbsent = student.status === "ABSENT";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(student.id)}
      className={`min-h-[72px] w-full rounded-xl border px-4 py-3 text-left shadow-sm transition ${
        isAbsent
          ? "border-red-300 bg-red-50 text-red-950"
          : "border-emerald-300 bg-emerald-50 text-emerald-950"
      } ${disabled ? "cursor-not-allowed opacity-75" : "touch-manipulation active:scale-[0.99]"}`}
      aria-pressed={isAbsent}
      aria-label={`${student.name}, roll ${student.rollNumber ?? "-"}, ${student.status.toLowerCase()}. Tap to mark ${isAbsent ? "present" : "absent"}.`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold ${isAbsent ? "bg-red-100" : "bg-emerald-100"}`}>
            {student.rollNumber ?? "-"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{student.name}</p>
            <p className="text-xs font-medium opacity-70">Tap to mark {isAbsent ? "present" : "absent"}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${isAbsent ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
          {student.status}
        </span>
      </div>
    </button>
  );
}

export const StudentRow = memo(StudentRowComponent);
