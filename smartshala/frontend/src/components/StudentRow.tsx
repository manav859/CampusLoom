"use client";

import { memo } from "react";
import type { AttendanceStudent } from "@/hooks/useAttendance";
import type { AttendanceMarkStatus } from "@/lib/api";

type StudentRowProps = {
  student: AttendanceStudent;
  onToggle: (studentId: string) => void;
  onSetStatus: (studentId: string, status: AttendanceMarkStatus) => void;
  disabled?: boolean;
};

function StudentRowComponent({ student, onToggle, onSetStatus, disabled = false }: StudentRowProps) {
  const isAbsent = student.status === "ABSENT";
  const isLeave = student.status === "LEAVE";
  const statusStyles = {
    PRESENT: "bg-[#34c759] text-white",
    ABSENT: "bg-[#ff3b30] text-white",
    LEAVE: "bg-[#0d9488] text-white"
  } satisfies Record<AttendanceMarkStatus, string>;
  const statusLabels = {
    PRESENT: "Present",
    ABSENT: "Absent",
    LEAVE: "Leave"
  } satisfies Record<AttendanceMarkStatus, string>;
  const statusLetters = {
    PRESENT: "P",
    ABSENT: "A",
    LEAVE: "L"
  } satisfies Record<AttendanceMarkStatus, string>;

  return (
    <div
      className={`w-full rounded-2xl px-4 py-4 text-left transition-all duration-200 ease-apple border ${
        isAbsent
          ? "bg-[#ff3b30]/[0.04] border-[#ff3b30]/10 text-[#1d1d1f]"
          : isLeave
            ? "bg-[#0d9488]/[0.05] border-[#0d9488]/15 text-[#1d1d1f]"
            : "bg-[#34c759]/[0.04] border-[#34c759]/10 text-[#1d1d1f]"
      } ${disabled ? "cursor-not-allowed opacity-60" : "touch-manipulation hover:shadow-apple-sm active:scale-[0.99]"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold ${
            isAbsent ? "bg-[#ff3b30]/10 text-[#d70015]" : isLeave ? "bg-[#0d9488]/10 text-[#0b7f74]" : "bg-[#34c759]/10 text-[#248a3d]"
          }`}>
            {student.rollNumber ?? "-"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{student.name}</p>
            <button className="text-[12px] text-[#86868b] hover:text-[#1d1d1f]" disabled={disabled} onClick={() => onToggle(student.id)} type="button">
              Today's status
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/70 p-1">
          {(["PRESENT", "ABSENT", "LEAVE"] as AttendanceMarkStatus[]).map((status) => (
            <button
              aria-label={`Mark ${student.name} as ${statusLabels[status].toLowerCase()}`}
              aria-pressed={student.status === status}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                student.status === status ? statusStyles[status] : "text-[#6e6e73] hover:bg-[rgba(0,0,0,0.04)]"
              }`}
              disabled={disabled}
              key={status}
              onClick={() => onSetStatus(student.id, status)}
              title={statusLabels[status]}
              type="button"
            >
              {statusLetters[status]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const StudentRow = memo(StudentRowComponent);
