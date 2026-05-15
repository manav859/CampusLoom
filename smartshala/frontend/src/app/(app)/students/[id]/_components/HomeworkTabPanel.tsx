"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { whatsappApi, type StudentDetail } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";

export type HomeworkTabPanelProps = {
  student: StudentDetail;
};

function dateLabel(value: string | null) {
  if (!value) return "Not submitted";
  return formatDateShort(value);
}

function statusLabel(status: StudentDetail["homeworkAnalytics"]["assignments"][number]["status"]) {
  if (status === "ON_TIME") return "On time";
  if (status === "LATE") return "Late";
  if (status === "MISSING" || status === "NOT_SUBMITTED") return "Not submitted";
  return "Pending";
}

function statusTone(status: StudentDetail["homeworkAnalytics"]["assignments"][number]["status"]) {
  if (status === "ON_TIME") return "good";
  if (status === "LATE") return "warn";
  if (status === "MISSING" || status === "NOT_SUBMITTED") return "danger";
  return "neutral";
}

function needsParentNudge(status: StudentDetail["homeworkAnalytics"]["assignments"][number]["status"]) {
  return status === "MISSING" || status === "NOT_SUBMITTED";
}

export default function HomeworkTabPanel({ student }: HomeworkTabPanelProps) {
  const homework = student.homeworkAnalytics;
  const completion = homework.completionPercentage ?? 0;
  const lowCompletion = homework.counts.total > 0 && completion < 50;
  const [sendingAssignmentId, setSendingAssignmentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canNudgeParent = student.access.role === "PRINCIPAL" || student.access.role === "ADMIN" || student.access.role === "TEACHER";

  async function nudgeParent(assignment: StudentDetail["homeworkAnalytics"]["assignments"][number]) {
    setSendingAssignmentId(assignment.id);
    setNotice(null);
    setError(null);

    try {
      await whatsappApi.send({
        phone: student.parentPhone,
        message: `Dear parent, ${student.fullName} has not submitted "${assignment.title}" for ${assignment.subject}. Due date: ${formatDateShort(assignment.dueDate)}. Please help them complete it.`
      });
      setNotice(`Nudge sent for ${assignment.title}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send nudge");
    } finally {
      setSendingAssignmentId(null);
    }
  }

  return (
    <section className="space-y-4">
      {notice ? <div className="rounded-xl border border-[#0F8A4A]/20 bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-[#C8242C]/20 bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}

      <div className={`rounded-2xl border p-5 shadow-apple ${lowCompletion ? "border-[#ff3b30]/20 bg-[#ff3b30]/[0.06]" : "border-[rgba(0,0,0,0.04)] bg-white"}`}>
        <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">Homework completion</p>
            <p className={`mt-2 text-[52px] font-bold leading-none tracking-tight ${lowCompletion ? "text-[#c90011]" : "text-[#1d1d1f]"}`}>
              {homework.counts.total ? `${completion}%` : "--"}
            </p>
            <p className="mt-2 text-[12px] font-medium text-[#6e6e73]">On-time submissions over total assignments</p>
            <p className="mt-1 text-[12px] font-semibold text-[#5A6573]">
              {homework.counts.onTime} on time + {homework.counts.late} late + {homework.counts.missing} missing + {homework.counts.pending} pending = {homework.counts.total}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">On time</p>
              <p className="mt-1.5 text-[24px] font-semibold text-[#248a3d]">{homework.counts.onTime}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Late</p>
              <p className="mt-1.5 text-[24px] font-semibold text-[#cc7700]">{homework.counts.late}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Missing</p>
              <p className="mt-1.5 text-[24px] font-semibold text-[#c90011]">{homework.counts.missing}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Streak</p>
              <p className="mt-1.5 text-[24px] font-semibold text-[#1d1d1f]">{homework.currentStreak}</p>
              <p className="mt-1 text-[11px] font-semibold text-[#5A6573]">Class avg {homework.classAverageStreak}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Subject completion</h2>
            <p className="text-[12px] font-medium text-[#86868b]">Low completion is highlighted below 50%.</p>
          </div>
          <StatusPill label={`${homework.counts.total} assignments`} tone={homework.counts.total ? "good" : "neutral"} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {homework.subjects.length === 0 ? (
            <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">No homework assignments recorded yet.</div>
          ) : (
            homework.subjects.map((subject) => {
              const subjectLow = subject.total > 0 && subject.completionPercentage < 50;
              return (
                <div className={`rounded-xl p-4 ${subjectLow ? "bg-[#ff3b30]/[0.07]" : "bg-[rgba(0,0,0,0.02)]"}`} key={subject.subject}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">{subject.subject}</p>
                    <p className={`text-[13px] font-semibold ${subjectLow ? "text-[#c90011]" : "text-[#2456E6]"}`}>{subject.completionPercentage}%</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
                    <div className={`h-full rounded-full ${subjectLow ? "bg-[#ff3b30]" : "bg-[#2456E6]"}`} style={{ width: `${subject.completionPercentage}%` }} />
                  </div>
                  <p className="mt-2 text-[12px] text-[#86868b]">{subject.onTime} on time - {subject.late} late - {subject.missing} missing - {subject.total} total</p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
        <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Assignment log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-[13px]">
            <thead className="table-head">
              <tr>
                {["Assignment", "Subject", "Assigned", "Due", "Status", "Marks", "Teacher note", "Action"].map((head) => (
                  <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {homework.assignments.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-[#86868b]" colSpan={8}>No assignment log found.</td>
                </tr>
              ) : (
                homework.assignments.map((assignment) => (
                  <tr className="table-row" key={assignment.id}>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{assignment.title}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{assignment.subject}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{dateLabel(assignment.assignedDate)}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{dateLabel(assignment.dueDate)}</td>
                    <td className="px-5 py-4"><StatusPill label={statusLabel(assignment.status)} tone={statusTone(assignment.status)} /></td>
                    <td className="px-5 py-4 text-[#6e6e73]">
                      {assignment.marks === null ? "Not marked" : assignment.maxMarks === null ? assignment.marks : `${assignment.marks}/${assignment.maxMarks}`}
                    </td>
                    <td className="px-5 py-4 text-[#6e6e73]">{assignment.teacherNote ?? "-"}</td>
                    <td className="px-5 py-4">
                      {canNudgeParent && needsParentNudge(assignment.status) ? (
                        <button
                          className="rounded-md border border-[#C2C9D4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] transition-colors hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:text-[#7A8390]"
                          disabled={sendingAssignmentId === assignment.id}
                          onClick={() => nudgeParent(assignment)}
                          type="button"
                        >
                          {sendingAssignmentId === assignment.id ? "Sending..." : "Nudge parent"}
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#86868b]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
