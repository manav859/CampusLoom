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
      className={`w-full rounded-2xl px-4 py-4 text-left transition-all duration-200 ease-apple border ${
        isAbsent
          ? "bg-[#ff3b30]/[0.04] border-[#ff3b30]/10 text-[#1d1d1f]"
          : "bg-[#34c759]/[0.04] border-[#34c759]/10 text-[#1d1d1f]"
      } ${disabled ? "cursor-not-allowed opacity-60" : "touch-manipulation hover:shadow-apple-sm active:scale-[0.99]"}`}
      aria-pressed={isAbsent}
      aria-label={`${student.name}, roll ${student.rollNumber ?? "-"}, ${student.status.toLowerCase()}. Tap to mark ${isAbsent ? "present" : "absent"}.`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold ${
            isAbsent ? "bg-[#ff3b30]/10 text-[#d70015]" : "bg-[#34c759]/10 text-[#248a3d]"
          }`}>
            {student.rollNumber ?? "-"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{student.name}</p>
            <p className="text-[12px] text-[#86868b]">Tap to mark {isAbsent ? "present" : "absent"}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
          isAbsent ? "bg-[#ff3b30] text-white" : "bg-[#34c759] text-white"
        }`}>
          {student.status}
        </span>
      </div>
    </button>
  );
}

export const StudentRow = memo(StudentRowComponent);
