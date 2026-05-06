"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  homeworkApi,
  type HomeworkAssignment,
  type HomeworkAssignmentDetail,
  type HomeworkContext,
  type HomeworkSubmissionStatus
} from "@/lib/api";
import { cachedFetch } from "@/lib/prefetchCache";

const generalSubjectId = "__GENERAL__";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function assignmentTone(status: HomeworkAssignment["status"]) {
  if (status === "COMPLETED") return "good";
  if (status === "OVERDUE") return "danger";
  return "warn";
}

function submissionTone(status: HomeworkSubmissionStatus) {
  if (status === "ON_TIME") return "good";
  if (status === "LATE") return "warn";
  return "danger";
}

function submissionLabel(status: HomeworkSubmissionStatus) {
  if (status === "ON_TIME") return "Completed";
  if (status === "LATE") return "Late";
  return "Not submitted";
}

export default function TeacherHomeworkPage() {
  const [context, setContext] = useState<HomeworkContext>({ classes: [] });
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState(generalSubjectId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedDate, setAssignedDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState(todayInputValue());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<HomeworkAssignmentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingSubmissionId, setSavingSubmissionId] = useState("");
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, { marks: string; teacherNote: string }>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedClass = useMemo(() => context.classes.find((classRecord) => classRecord.id === classId) ?? null, [context.classes, classId]);
  const subjectOptions = selectedClass?.subjects ?? [];

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [homeworkContext, rows] = await Promise.all([
          cachedFetch("homework:context", () => homeworkApi.context()),
          cachedFetch("homework:assignments", () => homeworkApi.assignments())
        ]);
        if (!active) return;
        setContext(homeworkContext);
        setAssignments(rows);
        const firstClassId = homeworkContext.classes[0]?.id ?? "";
        setClassId(firstClassId);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load homework module");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSubjectId(subjectOptions[0]?.id ?? generalSubjectId);
  }, [classId, subjectOptions]);

  async function refreshAssignments(nextClassId = classId) {
    const rows = await homeworkApi.assignments(nextClassId || undefined);
    setAssignments(rows);
  }

  async function openAssignment(assignmentId: string) {
    setLoadingDetail(true);
    setError("");
    try {
      const detail = await homeworkApi.assignment(assignmentId);
      setSelectedAssignment(detail);
      setSubmissionDrafts(
        Object.fromEntries(
          detail.submissions.map((submission) => [
            submission.studentId,
            {
              marks: submission.marks === null ? "" : String(submission.marks),
              teacherNote: submission.teacherNote ?? ""
            }
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load submission tracking");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
    setError("");
    try {
      await refreshAssignments(nextClassId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load assignments");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId) {
      setError("Select a class before creating homework.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await homeworkApi.createAssignment({
        classId,
        ...(subjectId === generalSubjectId ? { subject: "General" } : { subjectId }),
        title: title.trim(),
        description: description.trim() || undefined,
        assignedDate,
        dueDate
      });
      setAssignments((current) => [created, ...current.filter((assignment) => assignment.id !== created.id)]);
      await openAssignment(created.id);
      setTitle("");
      setDescription("");
      setAssignedDate(todayInputValue());
      setDueDate(todayInputValue());
      setNotice("Homework assigned to the full class.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create homework");
    } finally {
      setSaving(false);
    }
  }

  async function updateSubmission(studentId: string, status: HomeworkSubmissionStatus) {
    if (!selectedAssignment) return;
    const draft = submissionDrafts[studentId] ?? { marks: "", teacherNote: "" };
    const numericMarks = draft.marks.trim() ? Number(draft.marks) : null;
    if (numericMarks !== null && (Number.isNaN(numericMarks) || numericMarks < 0 || numericMarks > 20)) {
      setError("Homework marks must be between 0 and 20.");
      return;
    }

    setSavingSubmissionId(studentId);
    setError("");
    setNotice("");
    try {
      const updated = await homeworkApi.updateSubmission(selectedAssignment.id, {
        studentId,
        status,
        marks: numericMarks,
        teacherNote: draft.teacherNote.trim() || null
      });
      const detail = await homeworkApi.assignment(selectedAssignment.id);
      setSelectedAssignment(detail);
      setAssignments((current) => current.map((assignment) => (assignment.id === detail.id ? detail : assignment)));
      setSubmissionDrafts((current) => ({
        ...current,
        [studentId]: {
          marks: updated.marks === null ? "" : String(updated.marks),
          teacherNote: updated.teacherNote ?? ""
        }
      }));
      setNotice(`${updated.studentName} marked as ${submissionLabel(updated.status).toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update submission");
    } finally {
      setSavingSubmissionId("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Teacher workspace</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Homework management</h1>
        </div>
        <StatusPill label={`${assignments.length} assignments`} tone={assignments.length ? "good" : "neutral"} />
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <form className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple" onSubmit={handleSubmit}>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Create assignment</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Class</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                disabled={loading}
                onChange={(event) => handleClassChange(event.target.value)}
                value={classId}
              >
                {context.classes.length === 0 ? <option value="">No assigned classes</option> : null}
                {context.classes.map((classRecord) => (
                  <option key={classRecord.id} value={classRecord.id}>
                    Class {classRecord.name}-{classRecord.section} ({classRecord.studentCount} students)
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Subject</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                onChange={(event) => setSubjectId(event.target.value)}
                value={subjectId}
              >
                {subjectOptions.length === 0 ? <option value={generalSubjectId}>General</option> : null}
                {subjectOptions.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Title</span>
              <input
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3]"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Chapter practice worksheet"
                value={title}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Description</span>
              <textarea
                className="mt-1.5 min-h-[110px] w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3]"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Instructions, pages, or expected work"
                value={description}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Assigned date</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  onChange={(event) => setAssignedDate(event.target.value)}
                  type="date"
                  value={assignedDate}
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Due date</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  min={assignedDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  value={dueDate}
                />
              </label>
            </div>

            <button
              className="w-full rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || loading || !classId}
              type="submit"
            >
              {saving ? "Assigning..." : "Assign to class"}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="flex flex-col gap-3 border-b border-[rgba(0,0,0,0.06)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Assignment list</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Submission tracking updates from homework submission rows.</p>
            </div>
            {selectedClass ? <StatusPill label={`Class ${selectedClass.name}-${selectedClass.section}`} tone="neutral" /> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  {["Title", "Subject", "Assigned Date", "Due Date", "Status", "Submitted", "Late", "Not submitted", "Tracking"].map((head) => (
                    <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 9 }).map((__, cell) => (
                        <td className="px-5 py-4" key={cell}><Skeleton className="h-4 w-20 rounded-md" /></td>
                      ))}
                    </tr>
                  ))
                ) : assignments.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={9}>No homework assignments created yet.</td>
                  </tr>
                ) : (
                  assignments.map((assignment) => (
                    <tr className="table-row" key={assignment.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#1d1d1f]">{assignment.title}</p>
                        {assignment.description ? <p className="mt-1 line-clamp-1 max-w-[260px] text-[12px] text-[#86868b]">{assignment.description}</p> : null}
                      </td>
                      <td className="px-5 py-4 text-[#6e6e73]">{assignment.subject}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{dateLabel(assignment.assignedDate)}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{dateLabel(assignment.dueDate)}</td>
                      <td className="px-5 py-4"><StatusPill label={assignment.status} tone={assignmentTone(assignment.status)} /></td>
                      <td className="px-5 py-4 font-semibold text-[#248a3d]">{assignment.submittedCount}</td>
                      <td className="px-5 py-4 font-semibold text-[#cc7700]">{assignment.lateCount}</td>
                      <td className="px-5 py-4 font-semibold text-[#d70015]">{assignment.notSubmittedCount}</td>
                      <td className="px-5 py-4">
                        <button
                          className="rounded-lg bg-[#0071e3]/10 px-3 py-1.5 text-[12px] font-semibold text-[#0071e3] transition hover:bg-[#0071e3] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={loadingDetail && selectedAssignment?.id === assignment.id}
                          onClick={() => openAssignment(assignment.id)}
                          type="button"
                        >
                          {loadingDetail && selectedAssignment?.id === assignment.id ? "Loading..." : "View students"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedAssignment ? (
        <section className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="flex flex-col gap-3 border-b border-[rgba(0,0,0,0.06)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Submission tracking</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">
                {selectedAssignment.title} | {selectedAssignment.className} | Due {dateLabel(selectedAssignment.dueDate)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill label={`${selectedAssignment.submittedCount} completed`} tone="good" />
              <StatusPill label={`${selectedAssignment.lateCount} late`} tone="warn" />
              <StatusPill label={`${selectedAssignment.notSubmittedCount} not submitted`} tone="danger" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  {["Student", "Status", "Marks", "Teacher note", "Actions"].map((head) => (
                    <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {selectedAssignment.submissions.map((submission) => {
                  const draft = submissionDrafts[submission.studentId] ?? { marks: "", teacherNote: "" };
                  const savingRow = savingSubmissionId === submission.studentId;
                  return (
                    <tr className="table-row" key={submission.studentId}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#1d1d1f]">{submission.studentName}</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">Roll {submission.rollNumber ?? "-"} | {submission.admissionNumber}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill label={submissionLabel(submission.status)} tone={submissionTone(submission.status)} />
                        {submission.submittedAt ? <p className="mt-1 text-[11px] text-[#86868b]">{dateLabel(submission.submittedAt)}</p> : null}
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className="w-24 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#0071e3]"
                          max={20}
                          min={0}
                          onChange={(event) =>
                            setSubmissionDrafts((current) => ({
                              ...current,
                              [submission.studentId]: { ...draft, marks: event.target.value }
                            }))
                          }
                          placeholder="/20"
                          type="number"
                          value={draft.marks}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className="w-full min-w-[240px] rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[13px] outline-none focus:border-[#0071e3]"
                          onChange={(event) =>
                            setSubmissionDrafts((current) => ({
                              ...current,
                              [submission.studentId]: { ...draft, teacherNote: event.target.value }
                            }))
                          }
                          placeholder="Optional note"
                          value={draft.teacherNote}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(["ON_TIME", "LATE", "NOT_SUBMITTED"] as HomeworkSubmissionStatus[]).map((status) => (
                            <button
                              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                submission.status === status
                                  ? "bg-[#1d1d1f] text-white"
                                  : "bg-[rgba(0,0,0,0.04)] text-[#424245] hover:bg-[rgba(0,0,0,0.08)]"
                              }`}
                              disabled={savingRow}
                              key={status}
                              onClick={() => updateSubmission(submission.studentId, status)}
                              type="button"
                            >
                              {savingRow ? "Saving..." : submissionLabel(status)}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
