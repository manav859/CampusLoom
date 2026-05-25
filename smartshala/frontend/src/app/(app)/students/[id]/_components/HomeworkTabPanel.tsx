"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { communicationApi, type StudentDetail } from "@/lib/api";
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
      await communicationApi.sendMessage({
        targetType: "STUDENT",
        studentId: student.id,
        type: "HOMEWORK_REMINDER",
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
      {notice ? <div className="rounded-[6px] border border-[#0F8A4A]/20 bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">{notice}</div> : null}
      {error ? <div className="rounded-[6px] border border-[#C8242C]/20 bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}

      <div className={`rounded-[6px] border p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5 ${lowCompletion ? "border-[#F1B8BD] bg-[#FFF7F8]" : "border-[#DCE1E8] bg-white"}`}>
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
            <div className="kpi-metric-card kpi-metric-card-good min-h-[96px] p-4">
              <p className="kpi-metric-label">On time</p>
              <p className="kpi-metric-value text-[24px] leading-7">{homework.counts.onTime}</p>
            </div>
            <div className="kpi-metric-card kpi-metric-card-warn min-h-[96px] p-4">
              <p className="kpi-metric-label">Late</p>
              <p className="kpi-metric-value text-[24px] leading-7">{homework.counts.late}</p>
            </div>
            <div className="kpi-metric-card kpi-metric-card-danger min-h-[96px] p-4">
              <p className="kpi-metric-label">Missing</p>
              <p className="kpi-metric-value text-[24px] leading-7">{homework.counts.missing}</p>
            </div>
            <div className="kpi-metric-card min-h-[96px] p-4">
              <p className="kpi-metric-label">Streak</p>
              <p className="kpi-metric-value text-[24px] leading-7">{homework.currentStreak}</p>
              <p className="mt-1 text-[11px] font-semibold text-[#5A6573]">Class avg {homework.classAverageStreak}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Subject completion</h2>
            <p className="text-[12px] font-medium text-[#86868b]">Low completion is highlighted below 50%.</p>
          </div>
          <StatusPill label={`${homework.counts.total} assignments`} tone={homework.counts.total ? "good" : "neutral"} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {homework.subjects.length === 0 ? (
            <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No homework assignments recorded yet.</div>
          ) : (
            homework.subjects.map((subject) => {
              const subjectLow = subject.total > 0 && subject.completionPercentage < 50;
              return (
                <div className={`rounded-[6px] p-4 ${subjectLow ? "bg-[#FFF7F8]" : "bg-[#F7F8FB]"}`} key={subject.subject}>
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

      <section className="overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="border-b border-[#E7EBF0] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Assignment log</h2>
        </div>
        <div className="space-y-3 p-4 md:hidden">
          {homework.assignments.length === 0 ? (
            <div className="rounded-[6px] bg-[#F7F8FB] p-4 text-[13px] font-medium text-[#86868b]">No assignment log found.</div>
          ) : (
            homework.assignments.map((assignment) => (
              <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_8px_22px_-18px_rgba(15,20,25,0.35)]" key={`mobile-assignment-${assignment.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-[#0F1419]">{assignment.title}</h3>
                    <p className="mt-1 text-[12px] font-medium text-[#5A6573]">{assignment.subject}</p>
                  </div>
                  <StatusPill label={statusLabel(assignment.status)} tone={statusTone(assignment.status)} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Assigned</p><p className="mt-1 font-bold text-[#0F1419]">{dateLabel(assignment.assignedDate)}</p></div>
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Due</p><p className="mt-1 font-bold text-[#0F1419]">{dateLabel(assignment.dueDate)}</p></div>
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Marks</p><p className="mt-1 font-bold text-[#0F1419]">{assignment.marks === null ? "-" : assignment.maxMarks === null ? assignment.marks : `${assignment.marks}/${assignment.maxMarks}`}</p></div>
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3"><p className="font-semibold text-[#7A8390]">Note</p><p className="mt-1 truncate font-bold text-[#0F1419]">{assignment.teacherNote ?? "-"}</p></div>
                </div>
                {canNudgeParent && needsParentNudge(assignment.status) ? (
                  <button className="mt-3 w-full rounded-[6px] border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2456E6] hover:bg-[#F7F8FB]" disabled={sendingAssignmentId === assignment.id} onClick={() => nudgeParent(assignment)} type="button">
                    {sendingAssignmentId === assignment.id ? "Sending..." : "Nudge parent"}
                  </button>
                ) : null}
              </article>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[920px] border-collapse bg-white text-center text-[14px] text-[#001B33]">
            <thead>
              <tr className="bg-[#DDECF8]">
                {["Assignment", "Subject", "Assigned", "Due", "Status", "Marks", "Teacher note", "Action"].map((head) => (
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[14px] font-semibold text-[#031526]" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {homework.assignments.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-[#86868b]" colSpan={8}>No assignment log found.</td>
                </tr>
              ) : (
                homework.assignments.map((assignment) => (
                  <tr className="transition-colors duration-200 hover:bg-[#F8FBFD]" key={assignment.id}>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold text-[#1d1d1f]">{assignment.title}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{assignment.subject}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{dateLabel(assignment.assignedDate)}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{dateLabel(assignment.dueDate)}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center"><StatusPill label={statusLabel(assignment.status)} tone={statusTone(assignment.status)} /></td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">
                      {assignment.marks === null ? "Not marked" : assignment.maxMarks === null ? assignment.marks : `${assignment.marks}/${assignment.maxMarks}`}
                    </td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">{assignment.teacherNote ?? "-"}</td>
                    <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
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
