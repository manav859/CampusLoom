"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  communicationApi,
  homeworkApi,
  type HomeworkAssignment,
  type HomeworkAssignmentDetail,
  type HomeworkContext,
  type HomeworkSubmissionStatus
} from "@/lib/api";
import { formatDateShort, formatDateTimeShort } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
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

type AssignmentFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "CLOSED";
type FlashTone = "success" | "info" | "warning" | "danger";

function daysUntil(date: string | Date) {
  const due = new Date(date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function assignmentStatusLabel(assignment: HomeworkAssignment) {
  const days = daysUntil(assignment.dueDate);
  if (assignment.status === "OVERDUE") return `Overdue - ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (assignment.status === "COMPLETED") return "Closed";
  if (days >= 0 && days <= 3) return days === 0 ? "Due today" : `Due soon - ${days} day${days === 1 ? "" : "s"}`;
  return "Open";
}

function assignmentStatusTone(assignment: HomeworkAssignment) {
  const days = daysUntil(assignment.dueDate);
  if (assignment.status === "COMPLETED") return "good";
  if (assignment.status === "OVERDUE" && Math.abs(days) >= 3) return "danger";
  if (assignment.status === "OVERDUE") return "warn";
  if (days >= 0 && days <= 3) return "warn";
  return "neutral";
}

export default function TeacherHomeworkPage() {
  const [context, setContext] = useState<HomeworkContext>({ classes: [] });
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedDate, setAssignedDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState(todayInputValue());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<HomeworkAssignmentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingDetailAssignmentId, setLoadingDetailAssignmentId] = useState("");
  const [savingSubmissionId, setSavingSubmissionId] = useState("");
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, { marks: string; teacherNote: string }>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [flash, setFlash] = useState<{ message: string; tone: FlashTone } | null>(null);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [rubricNames, setRubricNames] = useState<string[]>([]);
  const [estimatedTime, setEstimatedTime] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("ALL");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [filterClassPickerOpen, setFilterClassPickerOpen] = useState(false);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);

  const selectedClass = useMemo(() => context.classes.find((classRecord) => classRecord.id === classId) ?? null, [context.classes, classId]);
  const subjectOptions = selectedClass?.subjects ?? [];
  const selectedSubject = subjectOptions.find((subject) => subject.id === subjectId) ?? null;
  const selectedClassHasSubjects = subjectOptions.length > 0;
  const selectedAssignmentAverage = useMemo(() => {
    if (!selectedAssignment) return null;
    const marks = selectedAssignment.submissions
      .map((submission) => submission.marks)
      .filter((mark): mark is number => typeof mark === "number");
    return marks.length ? Math.round((marks.reduce((sum, mark) => sum + mark, 0) / marks.length) * 10) / 10 : null;
  }, [selectedAssignment]);
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
    if (assignmentFilter === "OVERDUE") return assignment.status === "OVERDUE";
    if (assignmentFilter === "CLOSED") return assignment.status === "COMPLETED";
    if (assignmentFilter === "DUE_SOON") {
      const days = daysUntil(assignment.dueDate);
      return assignment.status !== "COMPLETED" && days >= 0 && days <= 3;
    }
    return true;
  }), [assignmentFilter, assignments]);

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
    setSubjectId(subjectOptions[0]?.id ?? "");
  }, [classId, subjectOptions]);

  useEffect(() => {
    if (!submissionModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSubmissionModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [submissionModalOpen]);

  useEffect(() => {
    if (!flash) return;
    const timeout = window.setTimeout(() => setFlash(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  function showFlash(message: string, tone: FlashTone = "success") {
    setFlash({ message, tone });
  }

  async function refreshAssignments(nextClassId = classId) {
    const rows = await homeworkApi.assignments(nextClassId || undefined);
    setAssignments(rows);
  }

  async function openAssignment(assignmentId: string) {
    setLoadingDetail(true);
    setLoadingDetailAssignmentId(assignmentId);
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
      setSubmissionModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load submission tracking");
    } finally {
      setLoadingDetail(false);
      setLoadingDetailAssignmentId("");
    }
  }

  async function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
    setSubmissionModalOpen(false);
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
    if (!subjectId) {
      setError("Subject is required. Assign subjects before creating homework.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await homeworkApi.createAssignment({
        classId,
        subjectId,
        title: title.trim(),
        description: [
          description.trim(),
          estimatedTime.trim() ? `Estimated time: ${estimatedTime.trim()} minutes` : "",
          attachmentNames.length ? `Attachments: ${attachmentNames.join(", ")}` : "",
          rubricNames.length ? `Rubric/answer key: ${rubricNames.join(", ")}` : ""
        ].filter(Boolean).join("\n") || undefined,
        assignedDate,
        dueDate
      });
      setAssignments((current) => [created, ...current.filter((assignment) => assignment.id !== created.id)]);
      await openAssignment(created.id);
      setTitle("");
      setDescription("");
      setAssignedDate(todayInputValue());
      setDueDate(todayInputValue());
      setAttachmentNames([]);
      setRubricNames([]);
      setEstimatedTime("");
      setNotice("Homework assigned to the full class.");
      setCreateModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create homework");
    } finally {
      setSaving(false);
    }
  }

  function insertDescription(prefix: string, suffix = "") {
    setDescription((current) => `${current}${current ? "\n" : ""}${prefix}${suffix}`);
  }

  function handleHomeworkFiles(files: FileList | null) {
    const names: string[] = [];
    for (const file of Array.from(files ?? [])) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10MB.`);
        return;
      }
      names.push(file.name);
    }
    setAttachmentNames(names);
  }

  function handleRubricFiles(files: FileList | null) {
    const names: string[] = [];
    for (const file of Array.from(files ?? [])) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10MB.`);
        return;
      }
      names.push(file.name);
    }
    setRubricNames(names);
  }

  async function nudgeNonSubmitters(assignment: HomeworkAssignment) {
    setError("");
    setNotice("");
    showFlash("Sending WhatsApp nudges...", "info");
    try {
      const detail = selectedAssignment?.id === assignment.id ? selectedAssignment : await homeworkApi.assignment(assignment.id);
      const pending = detail.submissions.filter((submission) => submission.status !== "ON_TIME" && submission.status !== "LATE");
      if (pending.length === 0) {
        setNotice("No non-submitters to nudge.");
        showFlash("No non-submitters to nudge.", "warning");
        return;
      }
      await Promise.all(pending.map((submission) => communicationApi.sendMessage({
        targetType: "STUDENT",
        studentId: submission.studentId,
        type: "HOMEWORK_REMINDER",
        message: `Dear parent, ${submission.studentName} has not submitted "${assignment.title}" yet. Please help complete it by ${formatDateShort(assignment.dueDate)}.`
      })));
      setNotice(`Queued WhatsApp nudges for ${pending.length} non-submitters.`);
      showFlash(`Queued WhatsApp nudges for ${pending.length} non-submitters.`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to nudge non-submitters";
      setError(message);
      showFlash(message, "danger");
    }
  }

  async function updateSubmission(studentId: string, status: HomeworkSubmissionStatus, options: { announce?: boolean } = {}) {
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
      if (options.announce !== false) {
        setNotice(`${updated.studentName} saved as ${submissionLabel(updated.status).toLowerCase()}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update submission");
    } finally {
      setSavingSubmissionId("");
    }
  }

  function autoSaveDraft(submission: HomeworkAssignmentDetail["submissions"][number]) {
    const draft = submissionDrafts[submission.studentId] ?? { marks: "", teacherNote: "" };
    const savedMarks = submission.marks === null ? "" : String(submission.marks);
    const savedNote = submission.teacherNote ?? "";
    if (draft.marks === savedMarks && draft.teacherNote === savedNote) return;
    void updateSubmission(submission.studentId, submission.status, { announce: false });
  }

  function renderDatePicker(
    label: string,
    value: string,
    onSelect: (date: string) => void,
    minDate?: string
  ) {
    return (
      <div>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">{label}</span>
        <DatePicker
          buttonClassName="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10"
          min={minDate}
          onChange={onSelect}
          value={value}
        />
      </div>
    );
  }

  const flashToneClass =
    flash?.tone === "success"
      ? "border-[#BCE5C8] bg-[#E1F5EA] text-[#0F8A4A]"
      : flash?.tone === "warning"
        ? "border-[#F3D39A] bg-[#FFF2DC] text-[#B95A00]"
        : flash?.tone === "danger"
          ? "border-[#F3B8BD] bg-[#FCE3E5] text-[#C8242C]"
          : "border-[#B9D8F2] bg-[#E2F0FB] text-[#1F6FB8]";

  return (
    <div className="space-y-5">
      {flash && typeof document !== "undefined" ? createPortal((
        <div className="fixed left-0 right-0 top-4 z-[300] flex justify-center px-4">
          <div className={`flex w-full max-w-md items-center justify-between gap-3 rounded-[8px] border px-4 py-3 text-[13px] font-semibold shadow-[0_12px_32px_rgba(15,20,25,0.18)] ${flashToneClass}`} role="status">
            <span>{flash.message}</span>
            <button className="shrink-0 underline-offset-2 hover:underline" onClick={() => setFlash(null)} type="button">Dismiss</button>
          </div>
        </div>
      ), document.body) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Teacher workspace</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Homework management</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <StatusPill label={`${assignments.length} assignments`} tone={assignments.length ? "good" : "neutral"} />
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-[#2456E6] px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,20,25,0.08)] transition hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || !classId || !selectedClassHasSubjects}
            onClick={() => setCreateModalOpen(true)}
            type="button"
          >
            Assign homework
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}
      {!loading && selectedClass && !selectedClassHasSubjects ? (
        <div className="rounded-xl border border-[#B95A00]/20 bg-[#FFF2DC] px-4 py-3 text-[13px] font-medium text-[#B95A00]">
          No subjects are assigned for Class {selectedClass.name}-{selectedClass.section}. Add subjects before creating teacher homework.
        </div>
      ) : null}

      <Modal
        fullScreen
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="lg"
        title="Assign homework"
        description={selectedClass ? `Class ${selectedClass.name}-${selectedClass.section} | ${selectedClass.studentCount} students` : "Create and assign homework to a full class."}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Class</span>
                <button
                  className="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                  onClick={() => {
                    setClassPickerOpen(!classPickerOpen);
                    setSubjectPickerOpen(false);
                  }}
                  type="button"
                >
                  <span>{selectedClass ? `Class ${selectedClass.name}-${selectedClass.section} (${selectedClass.studentCount} students)` : "No assigned classes"}</span>
                  <svg className={`h-4 w-4 text-[#52687D] transition ${classPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {classPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[76px] z-30 max-h-72 overflow-auto rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                    {context.classes.length === 0 ? (
                      <div className="rounded-xl bg-[#F7F8FB] px-3 py-3 text-[13px] font-semibold text-[#86868b]">No assigned classes</div>
                    ) : (
                      context.classes.map((classRecord) => (
                        <button
                          className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${classRecord.id === classId ? "bg-[#2456E6] text-white" : "text-[#031526] hover:bg-[#F2F7FC]"}`}
                          key={classRecord.id}
                          onClick={() => {
                            setClassPickerOpen(false);
                            void handleClassChange(classRecord.id);
                          }}
                          type="button"
                        >
                          Class {classRecord.name}-{classRecord.section} ({classRecord.studentCount} students)
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Subject</span>
                <button
                  className="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={subjectOptions.length === 0}
                  onClick={() => {
                    setSubjectPickerOpen(!subjectPickerOpen);
                    setClassPickerOpen(false);
                  }}
                  type="button"
                >
                  <span>{selectedSubject?.name ?? "No subjects assigned"}</span>
                  <svg className={`h-4 w-4 text-[#52687D] transition ${subjectPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {subjectPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[76px] z-30 max-h-72 overflow-auto rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                    {subjectOptions.map((subject) => (
                      <button
                        className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${subject.id === subjectId ? "bg-[#2456E6] text-white" : "text-[#031526] hover:bg-[#F2F7FC]"}`}
                        key={subject.id}
                        onClick={() => {
                          setSubjectPickerOpen(false);
                          setSubjectId(subject.id);
                        }}
                        type="button"
                      >
                        {subject.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

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
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button className="rounded-lg border border-[#DCE1E8] px-2 py-1 text-[12px] font-semibold text-[#2A3340]" onClick={() => insertDescription("**Important:** ")} type="button">Bold</button>
                <button className="rounded-lg border border-[#DCE1E8] px-2 py-1 text-[12px] font-semibold text-[#2A3340]" onClick={() => insertDescription("- ")} type="button">Bullet</button>
                <button className="rounded-lg border border-[#DCE1E8] px-2 py-1 text-[12px] font-semibold text-[#2A3340]" onClick={() => insertDescription("Answer in notebook with steps shown.")} type="button">Instruction</button>
              </div>
              <textarea
                className="mt-1.5 min-h-[150px] w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3]"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Instructions, pages, or expected work"
                value={description}
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Estimated time</span>
                <input
                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#C9D3DE] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                  min={1}
                  onChange={(event) => setEstimatedTime(event.target.value)}
                  placeholder="30"
                  type="number"
                  value={estimatedTime}
                />
              </label>
              {renderDatePicker("Assigned date", assignedDate, setAssignedDate)}
              {renderDatePicker("Due date", dueDate, setDueDate, assignedDate)}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Attachments</span>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-dashed border-[#C9D3DE] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                  multiple
                  onChange={(event) => handleHomeworkFiles(event.target.files)}
                  type="file"
                />
                <p className="mt-1 text-[12px] font-medium text-[#86868b]">PDF, JPG, PNG up to 10MB each.</p>
                {attachmentNames.length ? <p className="mt-1 text-[12px] font-semibold text-[#1d1d1f]">{attachmentNames.join(", ")}</p> : null}
              </label>

              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Rubric / answer key attachment</span>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-dashed border-[#C9D3DE] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                  multiple
                  onChange={(event) => handleRubricFiles(event.target.files)}
                  type="file"
                />
                {rubricNames.length ? <p className="mt-1 text-[12px] font-semibold text-[#1d1d1f]">{rubricNames.join(", ")}</p> : null}
              </label>
            </div>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || loading || !classId || !subjectId}
              type="submit"
            >
              {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
              {saving ? "Assigning..." : "Assign to class"}
            </button>
          </div>
        </form>
      </Modal>

      <section className="space-y-4">
        <div className="w-full overflow-hidden rounded-[6px] border border-[#C9D3DE] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
          <div className="flex flex-col gap-4 border-b border-[#C9D3DE] px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-[20px] font-semibold text-[#031526]">Assignment list</h2>
              <p className="mt-0.5 text-[14px] font-medium text-[#52687D]">Submission tracking updates from homework submission rows.</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-[240px]">
                <button
                  className="flex min-h-10 w-full items-center justify-between gap-3 rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#031526] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                  onClick={() => setFilterClassPickerOpen((open) => !open)}
                  type="button"
                >
                  <span className="truncate">{selectedClass ? `Class ${selectedClass.name}-${selectedClass.section}` : "All assigned classes"}</span>
                  <svg className={`h-4 w-4 shrink-0 text-[#52687D] transition ${filterClassPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {filterClassPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[46px] z-30 max-h-72 overflow-auto rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                    {context.classes.length === 0 ? (
                      <div className="rounded-xl bg-[#F7F8FB] px-3 py-3 text-[13px] font-semibold text-[#86868b]">No assigned classes</div>
                    ) : (
                      context.classes.map((classRecord) => (
                        <button
                          className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${classRecord.id === classId ? "bg-[#2456E6] text-white" : "text-[#031526] hover:bg-[#F2F7FC]"}`}
                          key={classRecord.id}
                          onClick={() => {
                            setFilterClassPickerOpen(false);
                            void handleClassChange(classRecord.id);
                          }}
                          type="button"
                        >
                          Class {classRecord.name}-{classRecord.section} ({classRecord.studentCount} students)
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "OVERDUE", "DUE_SOON", "CLOSED"] as AssignmentFilter[]).map((filter) => (
                  <button
                    className={`rounded-[5px] border px-4 py-2 text-[13px] font-semibold ${assignmentFilter === filter ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#C9D3DE] bg-white text-[#031526]"}`}
                    key={filter}
                    onClick={() => setAssignmentFilter(filter)}
                    type="button"
                  >
                    {filter === "ALL" ? "All" : filter === "OVERDUE" ? "Overdue" : filter === "DUE_SOON" ? "Due soon" : "Closed"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="space-y-3 md:hidden">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4" key={index}>
                    <Skeleton className="h-4 w-40 rounded-md" />
                    <Skeleton className="mt-3 h-3 w-28 rounded-md" />
                    <Skeleton className="mt-4 h-9 w-full rounded-md" />
                  </div>
                ))
              ) : visibleAssignments.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] px-4 py-8 text-center text-[13px] font-medium text-[#52687D]">
                  No homework assignments match this filter.
                </div>
              ) : (
                visibleAssignments.map((assignment) => (
                  <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]" key={assignment.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-[#1d1d1f]">{assignment.title}</h3>
                        <p className="mt-1 text-[12px] font-medium text-[#52687D]">{assignment.subject} | Due {formatDateShort(assignment.dueDate)}</p>
                      </div>
                      <StatusPill label={assignmentStatusLabel(assignment)} tone={assignmentStatusTone(assignment)} />
                    </div>
                    {assignment.description ? <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#6e6e73]">{assignment.description}</p> : null}
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-[6px] bg-[#F7F8FB] px-2 py-2">
                        <p className="text-[16px] font-semibold text-[#248a3d]">{assignment.submittedCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52687D]">Done</p>
                      </div>
                      <div className="rounded-[6px] bg-[#F7F8FB] px-2 py-2">
                        <p className="text-[16px] font-semibold text-[#B95A00]">{assignment.lateCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52687D]">Late</p>
                      </div>
                      <div className="rounded-[6px] bg-[#F7F8FB] px-2 py-2">
                        <p className="text-[16px] font-semibold text-[#d70015]">{assignment.notSubmittedCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52687D]">Missing</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      <button
                        className="min-h-10 rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[13px] font-semibold text-[#2456E6] transition hover:bg-[#F2F7FC] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loadingDetail && loadingDetailAssignmentId === assignment.id}
                        onClick={() => openAssignment(assignment.id)}
                        type="button"
                      >
                        {loadingDetail && loadingDetailAssignmentId === assignment.id ? "Loading..." : "View students"}
                      </button>
                      {assignment.notSubmittedCount > 0 ? (
                        <button
                          className="min-h-10 rounded-[6px] border border-[#E7C585] bg-[#FFF8EA] px-3 text-[13px] font-semibold text-[#B95A00]"
                          onClick={() => nudgeNonSubmitters(assignment)}
                          type="button"
                        >
                          Nudge non-submitters
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="hidden max-h-[520px] overflow-auto rounded-[5px] border border-[#C9D3DE] [contain:content] md:block">
            <table className="w-full min-w-[1320px] table-fixed border-collapse text-left text-[14px] text-[#001B33]">
              <colgroup>
                <col className="w-[230px]" />
                <col className="w-[130px]" />
                <col className="w-[145px]" />
                <col className="w-[145px]" />
                <col className="w-[190px]" />
                <col className="w-[115px]" />
                <col className="w-[90px]" />
                <col className="w-[150px]" />
                <col className="w-[110px]" />
                <col className="w-[215px]" />
              </colgroup>
              <thead>
                <tr className="table-head-row">
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-5 py-4 text-[14px] font-semibold">Title</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Subject</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Assigned Date</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Due Date</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Status</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center text-[14px] font-semibold">Submitted</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center text-[14px] font-semibold">Late</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center text-[14px] font-semibold">Not submitted</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center text-[14px] font-semibold">Class avg</th>
                  <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 10 }).map((__, cell) => (
                        <td className="border-b border-[#C9D3DE] px-4 py-5" key={cell}><Skeleton className="h-4 w-20 rounded-md" /></td>
                      ))}
                    </tr>
                  ))
                ) : visibleAssignments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-[#52687D]" colSpan={10}>No homework assignments match this filter.</td>
                  </tr>
                ) : (
                  visibleAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td className="border-b border-[#C9D3DE] px-5 py-4 align-middle">
                        <p className="truncate font-semibold text-[#1d1d1f]">{assignment.title}</p>
                        {assignment.description ? <p className="mt-1 line-clamp-1 max-w-[260px] text-[12px] text-[#86868b]">{assignment.description}</p> : null}
                      </td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle text-[#52687D]">{assignment.subject}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle text-[#52687D]">{formatDateShort(assignment.assignedDate)}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle text-[#52687D]">{formatDateShort(assignment.dueDate)}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle"><StatusPill label={assignmentStatusLabel(assignment)} tone={assignmentStatusTone(assignment)} /></td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center align-middle font-semibold text-[#248a3d]">{assignment.submittedCount}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center align-middle font-semibold text-[#cc7700]">{assignment.lateCount}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center align-middle font-semibold text-[#d70015]">{assignment.notSubmittedCount}</td>
                      <td className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center align-middle font-semibold text-[#1d1d1f]">
                        {selectedAssignment?.id === assignment.id && selectedAssignmentAverage !== null ? `${selectedAssignmentAverage}/20` : "-"}
                      </td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4 align-middle">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-[5px] border border-[#C9D3DE] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] transition hover:bg-[#F2F7FC] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={loadingDetail && loadingDetailAssignmentId === assignment.id}
                            onClick={() => openAssignment(assignment.id)}
                            type="button"
                          >
                            {loadingDetail && loadingDetailAssignmentId === assignment.id ? "Loading..." : "View students"}
                          </button>
                          {assignment.notSubmittedCount > 0 ? (
                            <button
                              className="rounded-[5px] border border-[#C9D3DE] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#B95A00] transition hover:bg-[#FFF2DC]"
                              onClick={() => nudgeNonSubmitters(assignment)}
                              type="button"
                            >
                              Nudge non-submitters
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </section>

      {submissionModalOpen && selectedAssignment && typeof document !== "undefined" ? createPortal((
        <div className="fixed left-0 top-0 z-[200] flex h-[100dvh] w-[100vw] items-stretch justify-stretch overflow-hidden bg-black/40 p-0 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button className="absolute inset-0 cursor-default" aria-label="Close submission tracking" onClick={() => setSubmissionModalOpen(false)} type="button" />
          <div className="relative z-10 h-[100dvh] max-h-[100dvh] w-[100vw] max-w-none overflow-y-auto rounded-none">
            <button
              aria-label="Close submission tracking"
              className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE1E8] bg-white text-[#52687D] shadow-[0_4px_16px_rgba(15,20,25,0.14)] transition hover:bg-[#F7F8FB] hover:text-[#031526]"
              onClick={() => setSubmissionModalOpen(false)}
              type="button"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <section className="min-h-[100dvh] w-[100vw] overflow-hidden rounded-none border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
              <div className="flex flex-col gap-3 border-b border-[rgba(0,0,0,0.06)] px-5 py-4 pr-14 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Submission tracking</h2>
                  <p className="mt-0.5 text-[13px] text-[#86868b]">
                    {selectedAssignment.title} | Due {formatDateShort(selectedAssignment.dueDate)}
                  </p>
                  <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-[#F1F3F6]">
                    <div
                      className="h-full rounded-full bg-[#2456E6]"
                      style={{
                        width: `${selectedAssignment.totalStudents ? Math.round(((selectedAssignment.submittedCount + selectedAssignment.lateCount) / selectedAssignment.totalStudents) * 100) : 0}%`
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-[#5A6573]">
                    {selectedAssignment.submittedCount + selectedAssignment.lateCount} of {selectedAssignment.totalStudents} submitted - {selectedAssignment.totalStudents ? Math.round(((selectedAssignment.submittedCount + selectedAssignment.lateCount) / selectedAssignment.totalStudents) * 100) : 0}% complete
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`${selectedAssignment.submittedCount} completed`} tone="good" />
                  <StatusPill label={`${selectedAssignment.lateCount} late`} tone="warn" />
                  <StatusPill label={`${selectedAssignment.notSubmittedCount} not submitted`} tone="danger" />
                  <StatusPill label={selectedAssignmentAverage !== null ? `Class avg ${selectedAssignmentAverage}/20` : "Class avg pending"} tone={selectedAssignmentAverage !== null ? "good" : "neutral"} />
                </div>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {selectedAssignment.submissions.map((submission) => {
                  const draft = submissionDrafts[submission.studentId] ?? { marks: "", teacherNote: "" };
                  const savingRow = savingSubmissionId === submission.studentId;
                  return (
                    <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4" key={submission.studentId}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1d1d1f]">{submission.studentName}</p>
                          <p className="mt-1 text-[12px] text-[#86868b]">Roll {submission.rollNumber ?? "-"} | <span className="type-code">{submission.admissionNumber}</span></p>
                        </div>
                        <StatusPill label={submissionLabel(submission.status)} tone={submissionTone(submission.status)} />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-[#DCE1E8] bg-[#F7F8FB] p-1">
                        {(["ON_TIME", "LATE", "NOT_SUBMITTED"] as HomeworkSubmissionStatus[]).map((status) => (
                          <button
                            className={`min-h-9 rounded-lg px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              submission.status === status
                                ? `${submissionTone(status) === "good" ? "bg-[#E1F5EA] text-[#0F8A4A]" : submissionTone(status) === "warn" ? "bg-[#FFF2DC] text-[#B95A00]" : "bg-[#FCE3E5] text-[#C8242C]"} shadow-sm`
                                : "text-[#5A6573]"
                            }`}
                            disabled={savingRow}
                            key={status}
                            onClick={() => updateSubmission(submission.studentId, status)}
                            type="button"
                          >
                            {status === "NOT_SUBMITTED" ? "Missing" : submissionLabel(status)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3">
                        <input
                          className="min-h-10 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 text-[13px] font-semibold outline-none focus:border-[#0071e3]"
                          max={20}
                          min={0}
                          onChange={(event) =>
                            setSubmissionDrafts((current) => ({
                              ...current,
                              [submission.studentId]: { ...draft, marks: event.target.value }
                            }))
                          }
                          onBlur={() => autoSaveDraft(submission)}
                          placeholder="Marks /20"
                          type="number"
                          value={draft.marks}
                        />
                        <input
                          className="min-h-10 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 text-[13px] outline-none focus:border-[#0071e3]"
                          onChange={(event) =>
                            setSubmissionDrafts((current) => ({
                              ...current,
                              [submission.studentId]: { ...draft, teacherNote: event.target.value }
                            }))
                          }
                          onBlur={() => autoSaveDraft(submission)}
                          placeholder={`Note for ${submission.studentName}`}
                          value={draft.teacherNote}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] text-left text-[13px]">
                  <thead className="table-head">
                    <tr>
                      {["Student", "Status", "Marks", "Teacher note"].map((head) => (
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
                            <p className="mt-1 text-[12px] text-[#86868b]">Roll {submission.rollNumber ?? "-"} | <span className="type-code">{submission.admissionNumber}</span></p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="inline-flex rounded-xl border border-[#DCE1E8] bg-[#F7F8FB] p-1">
                              {(["ON_TIME", "LATE", "NOT_SUBMITTED"] as HomeworkSubmissionStatus[]).map((status) => (
                                <button
                                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    submission.status === status
                                      ? `${submissionTone(status) === "good" ? "bg-[#E1F5EA] text-[#0F8A4A]" : submissionTone(status) === "warn" ? "bg-[#FFF2DC] text-[#B95A00]" : "bg-[#FCE3E5] text-[#C8242C]"} shadow-sm`
                                      : "text-[#5A6573] hover:bg-white"
                                  }`}
                                  disabled={savingRow}
                                  key={status}
                                  onClick={() => updateSubmission(submission.studentId, status)}
                                  type="button"
                                >
                                  {savingRow ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current/40 border-t-current animate-spin" aria-hidden="true" /> : null}
                                  {savingRow ? "Saving..." : submissionLabel(status)}
                                </button>
                              ))}
                            </div>
                            {submission.submittedAt ? <p className="mt-1 text-[11px] text-[#86868b]">{formatDateTimeShort(submission.submittedAt)}</p> : null}
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
                              onBlur={() => autoSaveDraft(submission)}
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
                              onBlur={() => autoSaveDraft(submission)}
                              placeholder={`Note for ${submission.studentName}`}
                              value={draft.teacherNote}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ), document.body) : null}
    </div>
  );
}
