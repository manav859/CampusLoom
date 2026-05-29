"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { marksApi, type MarksContext, type MarksExam, type MarksExamDetail } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function examTone(status: MarksExam["status"]) {
  return status === "MARKS_ENTERED" ? "good" : "warn";
}

const examTermOptions: { value: MarksExam["term"]; label: string }[] = [
  { value: "UNIT_TEST", label: "Unit Test" },
  { value: "CLASS_TEST", label: "Class Test" }
];

function examTermLabel(term: MarksExam["term"]) {
  return examTermOptions.find((option) => option.value === term)?.label ?? "Unit Test";
}

function examStatusLabel(status: MarksExam["status"]) {
  return status === "MARKS_ENTERED" ? "Marks entered" : "Scheduled";
}

export default function TeacherMarksPage() {
  const [context, setContext] = useState<MarksContext>({ classes: [] });
  const [exams, setExams] = useState<MarksExam[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [name, setName] = useState("Unit Test 1");
  const [term, setTerm] = useState<MarksExam["term"]>("UNIT_TEST");
  const [maxMarks, setMaxMarks] = useState(100);
  const [passingMarks, setPassingMarks] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedExam, setSelectedExam] = useState<MarksExamDetail | null>(null);
  const [loadingExamId, setLoadingExamId] = useState("");
  const [savingStudentId, setSavingStudentId] = useState("");
  const [examDrafts, setExamDrafts] = useState<Record<string, string>>({});
  const [draftAbsent, setDraftAbsent] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [marksModalOpen, setMarksModalOpen] = useState(false);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [termPickerOpen, setTermPickerOpen] = useState(false);

  const selectedClass = useMemo(() => context.classes.find((classRecord) => classRecord.id === classId) ?? null, [context.classes, classId]);
  const subjects = useMemo(() => selectedClass?.subjects ?? [], [selectedClass]);
  const selectedSubject = useMemo(() => subjects.find((subject) => subject.id === subjectId) ?? null, [subjectId, subjects]);
  const students = useMemo(() => selectedClass?.students ?? [], [selectedClass]);
  const examsByTerm = useMemo(() => {
    const grouped = new Map<MarksExam["term"], MarksExam[]>();
    exams.forEach((exam) => {
      const rows = grouped.get(exam.term) ?? [];
      rows.push(exam);
      grouped.set(exam.term, rows);
    });
    return examTermOptions
      .map((option) => ({ ...option, exams: grouped.get(option.value) ?? [] }))
      .filter((group) => group.exams.length > 0);
  }, [exams]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [marksContext, rows] = await Promise.all([
          cachedFetch("marks:context", () => marksApi.context()),
          cachedFetch("marks:exams", () => marksApi.exams())
        ]);
        if (!active) return;
        setContext(marksContext);
        setExams(rows);
        const firstClass = marksContext.classes[0];
        setClassId(firstClass?.id ?? "");
        setSubjectId(firstClass?.subjects[0]?.id ?? "");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load marks module");
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
    const nextClass = context.classes.find((classRecord) => classRecord.id === classId);
    setSubjectId(nextClass?.subjects[0]?.id ?? "");
    setMarks(Object.fromEntries((nextClass?.students ?? []).map((student) => [student.id, ""])));
    setAbsent(Object.fromEntries((nextClass?.students ?? []).map((student) => [student.id, false])));
  }, [classId, context.classes]);

  async function refreshExams(nextClassId = classId) {
    const rows = await marksApi.exams(nextClassId || undefined);
    setExams(rows);
  }

  async function openExam(examId: string) {
    setLoadingExamId(examId);
    setError("");
    try {
      const detail = await marksApi.exam(examId);
      setSelectedExam(detail);
      setExamDrafts(
        Object.fromEntries(
          detail.students.map((student) => [
            student.studentId,
            student.result && !student.result.isAbsent ? String(student.result.marks) : ""
          ])
        )
      );
      setDraftAbsent(
        Object.fromEntries(
          detail.students.map((student) => [
            student.studentId,
            student.result ? student.result.isAbsent : false
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load exam students");
    } finally {
      setLoadingExamId("");
    }
  }

  async function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
    setError("");
    try {
      await refreshExams(nextClassId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load exams");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericMax = Number(maxMarks);
    if (!classId || !subjectId) {
      setError("Select class and subject before saving marks.");
      return;
    }
    if (!name.trim()) {
      setError("Exam name is required.");
      return;
    }
    if (!numericMax || numericMax <= 0) {
      setError("Max marks must be greater than zero.");
      return;
    }

    const results = students.map((student) => ({
      studentId: student.id,
      marks: Number(marks[student.id] ?? ""),
      isAbsent: absent[student.id] ?? false
    }));
    if (results.some((result) => !result.isAbsent && (Number.isNaN(result.marks) || result.marks < 0 || result.marks > numericMax))) {
      setError("Enter valid marks for every present student. Marks cannot exceed max marks.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await marksApi.createExam({
        classId,
        subjectId,
        name: name.trim(),
        term,
        maxMarks: numericMax,
        passingMarks: passingMarks ? Number(passingMarks) : undefined,
        description: description.trim() || undefined,
        date,
        results
      });
      setExams((current) => [created, ...current.filter((exam) => exam.id !== created.id)]);
      await openExam(created.id);
      setMarks(Object.fromEntries(students.map((student) => [student.id, ""])));
      setAbsent(Object.fromEntries(students.map((student) => [student.id, false])));
      setNotice("Exam marks saved for the full class.");
      setMarksModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save marks");
    } finally {
      setSaving(false);
    }
  }

  async function updateStudentMark(studentId: string) {
    if (!selectedExam) return;

    const isAbsent = draftAbsent[studentId] ?? false;
    const nextMarks = Number(examDrafts[studentId] ?? "");
    if (!isAbsent && (Number.isNaN(nextMarks) || nextMarks < 0 || nextMarks > selectedExam.maxMarks)) {
      setError(`Marks must be between 0 and ${selectedExam.maxMarks} for present students.`);
      return;
    }

    setSavingStudentId(studentId);
    setError("");
    setNotice("");
    try {
      const updated = await marksApi.updateExamResult(selectedExam.id, { studentId, marks: nextMarks, isAbsent });
      const detail = await marksApi.exam(selectedExam.id);
      setSelectedExam(detail);
      setExams((current) => current.map((exam) => (exam.id === detail.id ? detail : exam)));
      setExamDrafts((current) => ({
        ...current,
        [studentId]: updated.result ? String(updated.result.marks) : ""
      }));
      setNotice(`${updated.fullName} marks updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update marks");
    } finally {
      setSavingStudentId("");
    }
  }

  function renderDatePicker() {
    return (
      <div>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Date</span>
        <DatePicker
          buttonClassName="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10"
          onChange={setDate}
          value={date}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Teacher workspace</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Exams &amp; Marks</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <StatusPill label={`${exams.length} exams`} tone={exams.length ? "good" : "neutral"} />
          <button
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[#2456E6] px-5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,20,25,0.08)] transition hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={() => setMarksModalOpen(true)}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Create Exam
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <Modal
        isOpen={marksModalOpen}
        onClose={() => setMarksModalOpen(false)}
        size="xl"
        title="Create Exam"
        description={selectedClass ? `Class ${selectedClass.name}-${selectedClass.section} | ${selectedSubject?.name ?? "No subject"} | ${students.length} students` : "Create an exam and enter marks for the full class."}
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
                  <span>{selectedClass ? `Class ${selectedClass.name}-${selectedClass.section}` : "No assigned classes"}</span>
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
                          Class {classRecord.name}-{classRecord.section}
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
                  disabled={subjects.length === 0}
                  onClick={() => {
                    setSubjectPickerOpen(!subjectPickerOpen);
                    setClassPickerOpen(false);
                  }}
                  type="button"
                >
                  <span>{selectedSubject?.name ?? "No subjects"}</span>
                  <svg className={`h-4 w-4 text-[#52687D] transition ${subjectPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {subjectPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[76px] z-30 max-h-72 overflow-auto rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                    {subjects.map((subject) => (
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

            <div className="grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Exam name</span>
              <input
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#C9D3DE] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>

            <div className="relative">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Term / type</span>
              <button
                className="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10"
                onClick={() => setTermPickerOpen(!termPickerOpen)}
                type="button"
              >
                <span>{examTermLabel(term)}</span>
                <svg className={`h-4 w-4 text-[#52687D] transition ${termPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {termPickerOpen ? (
                <div className="absolute left-0 right-0 top-[76px] z-30 overflow-hidden rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                  {examTermOptions.map((option) => (
                    <button
                      className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${option.value === term ? "bg-[#2456E6] text-white" : "text-[#031526] hover:bg-[#F2F7FC]"}`}
                      key={option.value}
                      onClick={() => {
                        setTermPickerOpen(false);
                        setTerm(option.value);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Max marks</span>
              <input
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#C9D3DE] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                min={1}
                onChange={(event) => setMaxMarks(Number(event.target.value))}
                type="number"
                value={maxMarks}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Passing marks (Opt)</span>
              <input
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#C9D3DE] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                min={0}
                onChange={(event) => setPassingMarks(event.target.value)}
                type="number"
                value={passingMarks}
              />
            </label>
            {renderDatePicker()}
            <label className="block lg:col-span-4">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Description (Opt)</span>
              <input
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#C9D3DE] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            </label>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.06)]">
            <div className="border-b border-[rgba(0,0,0,0.06)] bg-[#f5f5f7] px-4 py-3">
              <p className="text-[13px] font-semibold text-[#1d1d1f]">Marks entry</p>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[360px] text-left text-[13px]">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Absent?</th>
                    <th className="px-4 py-3 font-semibold">Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-20 rounded-md" /></td>
                      </tr>
                    ))
                  ) : students.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-[#86868b]" colSpan={2}>No students in this class.</td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr className="table-row" key={student.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#1d1d1f]">{student.fullName}</p>
                          <p className="mt-0.5 text-[12px] text-[#86868b]">Roll {student.rollNumber ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={absent[student.id] ?? false}
                              onChange={(e) => setAbsent((current) => ({ ...current, [student.id]: e.target.checked }))}
                              className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                            />
                            <span className="text-[13px] font-medium text-[#86868b]">Absent</span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="w-24 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#0071e3] disabled:bg-gray-100 disabled:opacity-50"
                            disabled={absent[student.id]}
                            max={maxMarks}
                            min={0}
                            onChange={(event) => setMarks((current) => ({ ...current, [student.id]: event.target.value }))}
                            type="number"
                            value={absent[student.id] ? "" : (marks[student.id] ?? "")}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || loading || students.length === 0}
            type="submit"
          >
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving marks..." : "Bulk save marks"}
          </button>
        </form>
      </Modal>

      <section className="space-y-4">
        <div className="w-full overflow-hidden rounded-[6px] border border-[#C9D3DE] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
          <div className="border-b border-[#C9D3DE] px-6 py-5">
            <h2 className="text-[20px] font-semibold text-[#031526]">Exam history</h2>
            <p className="mt-0.5 text-[14px] font-medium text-[#52687D]">Saved exams feed the Academic tab and performance rate.</p>
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
              ) : exams.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] px-4 py-8 text-center text-[13px] font-medium text-[#52687D]">
                  No exams saved yet.
                </div>
              ) : (
                examsByTerm.map((group) => (
                  <div className="space-y-3" key={group.value}>
                    <p className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#52687D]">{group.label}</p>
                    {group.exams.map((exam) => (
                      <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]" key={exam.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-semibold text-[#1d1d1f]">{exam.name}</h3>
                            <p className="mt-1 text-[12px] font-medium text-[#52687D]">{exam.subject} | {formatDateShort(exam.date)}</p>
                            <p className="mt-0.5 text-[12px] text-[#86868b]">{exam.className} | Max {exam.maxMarks}</p>
                          </div>
                          <StatusPill label={examStatusLabel(exam.status)} tone={examTone(exam.status)} />
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-[6px] bg-[#F7F8FB] px-2 py-2">
                            <p className="text-[16px] font-semibold text-[#248a3d]">{exam.enteredCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52687D]">Entered</p>
                          </div>
                          <div className="rounded-[6px] bg-[#F7F8FB] px-2 py-2">
                            <p className="text-[16px] font-semibold text-[#d70015]">{exam.pendingCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52687D]">Pending</p>
                          </div>
                          <div className="rounded-[6px] bg-[#F7F8FB] px-2 py-2">
                            <p className="text-[16px] font-semibold text-[#1d1d1f]">{exam.classAverage}%</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52687D]">Avg</p>
                          </div>
                        </div>
                        <button
                          className="mt-4 min-h-10 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[13px] font-semibold text-[#2456E6] transition hover:bg-[#F2F7FC] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={loadingExamId === exam.id}
                          onClick={() => openExam(exam.id)}
                          type="button"
                        >
                          {loadingExamId === exam.id ? "Loading..." : "View students"}
                        </button>
                      </article>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="hidden max-h-[520px] overflow-auto rounded-[5px] border border-[#C9D3DE] [contain:content] md:block">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-[15px] text-[#001B33]">
              <thead>
                <tr className="table-head-row">
                  {["Exam", "Subject", "Max", "Date", "Status", "Entered", "Pending", "Class Avg", "Students"].map((head) => (
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[15px] font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 9 }).map((__, cell) => (
                        <td className="border-b border-[#C9D3DE] px-4 py-5" key={cell}><Skeleton className="h-4 w-20 rounded-md" /></td>
                      ))}
                    </tr>
                  ))
                ) : exams.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-[#52687D]" colSpan={9}>No exams saved yet.</td>
                  </tr>
                ) : (
                  examsByTerm.map((group) => (
                    <Fragment key={group.value}>
                      <tr>
                        <td className="border-b border-[#C9D3DE] bg-[#F7F8FB] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#52687D]" colSpan={9}>
                          {group.label}
                        </td>
                      </tr>
                      {group.exams.map((exam) => (
                        <tr key={exam.id}>
                          <td className="border-b border-[#C9D3DE] px-4 py-4">
                            <p className="font-semibold text-[#1d1d1f]">{exam.name}</p>
                            <p className="mt-1 text-[12px] text-[#86868b]">{exam.className}</p>
                          </td>
                          <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[#52687D]">{exam.subject}</td>
                          <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[#52687D]">{exam.maxMarks}</td>
                          <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[#52687D]">{formatDateShort(exam.date)}</td>
                          <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4"><StatusPill label={examStatusLabel(exam.status)} tone={examTone(exam.status)} /></td>
                          <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#248a3d]">{exam.enteredCount}</td>
                          <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#d70015]">{exam.pendingCount}</td>
                          <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 font-semibold text-[#1d1d1f]">{exam.classAverage}%</td>
                          <td className="border-b border-[#C9D3DE] px-4 py-4">
                            <button
                              className="rounded-[5px] border border-[#C9D3DE] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] transition hover:bg-[#F2F7FC] disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={loadingExamId === exam.id}
                              onClick={() => openExam(exam.id)}
                              type="button"
                            >
                              {loadingExamId === exam.id ? "Loading..." : "View students"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </section>

      {selectedExam ? (
        <section className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="flex flex-col gap-3 border-b border-[rgba(0,0,0,0.06)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Student marks</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">
                {selectedExam.name} | {examTermLabel(selectedExam.term)} | {selectedExam.className} | {selectedExam.subject} | Max {selectedExam.maxMarks}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill label={`${selectedExam.enteredCount} entered`} tone="good" />
              <StatusPill label={`${selectedExam.pendingCount} pending`} tone={selectedExam.pendingCount ? "danger" : "neutral"} />
              <StatusPill label={`${selectedExam.classAverage}% avg`} tone="neutral" />
            </div>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {selectedExam.students.map((student) => {
              const draft = examDrafts[student.studentId] ?? "";
              const isAbsent = draftAbsent[student.studentId] ?? false;
              const savingRow = savingStudentId === student.studentId;

              return (
                <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4" key={student.studentId}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#1d1d1f]">{student.fullName}</p>
                      <p className="mt-1 text-[12px] text-[#86868b]">Roll {student.rollNumber ?? "-"} | <span className="type-code">{student.admissionNumber}</span></p>
                    </div>
                    {student.result ? <StatusPill label={student.result.grade} tone="neutral" /> : <StatusPill label="Pending" tone="danger" />}
                  </div>
                  <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isAbsent}
                        onChange={(e) => setDraftAbsent((current) => ({ ...current, [student.studentId]: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                      />
                      <span className="text-[12px] font-medium text-[#86868b]">Absent</span>
                    </label>
                    <input
                      className="min-h-10 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 text-[13px] font-semibold outline-none focus:border-[#0071e3] disabled:bg-gray-100 disabled:opacity-50"
                      disabled={isAbsent}
                      max={selectedExam.maxMarks}
                      min={0}
                      onChange={(event) => setExamDrafts((current) => ({ ...current, [student.studentId]: event.target.value }))}
                      placeholder={`/${selectedExam.maxMarks}`}
                      type="number"
                      value={isAbsent ? "" : draft}
                    />
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1d1d1f] px-4 text-[12px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={savingRow}
                      onClick={() => updateStudentMark(student.studentId)}
                      type="button"
                    >
                      {savingRow ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
                      {savingRow ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-[6px] bg-[#F7F8FB] px-3 py-2 text-[12px]">
                    <span className="font-medium text-[#52687D]">Percentage</span>
                    <span className="font-semibold text-[#1d1d1f]">{student.result ? `${student.result.percentage}%` : "-"}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  {["Student", "Admission", "Roll", "Marks", "Percentage", "Grade", "Action"].map((head) => (
                    <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {selectedExam.students.map((student) => {
                  const draft = examDrafts[student.studentId] ?? "";
                  const isAbsent = draftAbsent[student.studentId] ?? false;
                  const savingRow = savingStudentId === student.studentId;

                  return (
                    <tr className="table-row" key={student.studentId}>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{student.fullName}</td>
                      <td className="px-5 py-4 type-code text-[#6e6e73]">{student.admissionNumber}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{student.rollNumber ?? "-"}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={isAbsent}
                              onChange={(e) => setDraftAbsent((current) => ({ ...current, [student.studentId]: e.target.checked }))}
                              className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                            />
                            <span className="text-[12px] font-medium text-[#86868b]">Abs</span>
                          </label>
                          <input
                            className="w-24 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#0071e3] disabled:bg-gray-100 disabled:opacity-50"
                            disabled={isAbsent}
                            max={selectedExam.maxMarks}
                            min={0}
                            onChange={(event) => setExamDrafts((current) => ({ ...current, [student.studentId]: event.target.value }))}
                            type="number"
                            value={isAbsent ? "" : draft}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">
                        {student.result ? `${student.result.percentage}%` : "-"}
                      </td>
                      <td className="px-5 py-4">
                        {student.result ? <StatusPill label={student.result.grade} tone="neutral" /> : <StatusPill label="Pending" tone="danger" />}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={savingRow}
                          onClick={() => updateStudentMark(student.studentId)}
                          type="button"
                        >
                          {savingRow ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
                          {savingRow ? "Saving..." : "Save"}
                        </button>
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
