"use client";

import type { AttendanceStudent } from "@/hooks/useAttendance";

type StudentRowProps = {
  student: AttendanceStudent;
  onToggle: (studentId: string) => void;
  disabled?: boolean;
};

export function StudentRow({ student, onToggle, disabled = false }: StudentRowProps) {
  const isAbsent = student.status === "ABSENT";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(student.id)}
      className={`min-h-[68px] w-full rounded-xl border px-4 py-3 text-left transition ${
        isAbsent
          ? "border-red-200 bg-red-50 text-red-950"
          : "border-emerald-200 bg-emerald-50 text-emerald-950"
      } ${disabled ? "cursor-not-allowed opacity-75" : "active:scale-[0.99]"}`}
      aria-pressed={isAbsent}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${isAbsent ? "bg-red-100" : "bg-emerald-100"}`}>
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
