"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { marksApi, type MarksContext, type MarksExam } from "@/lib/api";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function examTone(status: MarksExam["status"]) {
  return status === "MARKS_ENTERED" ? "good" : "warn";
}

export default function TeacherMarksPage() {
  const [context, setContext] = useState<MarksContext>({ classes: [] });
  const [exams, setExams] = useState<MarksExam[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [name, setName] = useState("Mid-Term");
  const [maxMarks, setMaxMarks] = useState(100);
  const [date, setDate] = useState(todayInputValue());
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedClass = useMemo(() => context.classes.find((classRecord) => classRecord.id === classId) ?? null, [context.classes, classId]);
  const subjects = selectedClass?.subjects ?? [];
  const students = selectedClass?.students ?? [];

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [marksContext, rows] = await Promise.all([marksApi.context(), marksApi.exams()]);
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
    setSubjectId(subjects[0]?.id ?? "");
    setMarks(Object.fromEntries(students.map((student) => [student.id, ""])));
  }, [classId, subjects, students]);

  async function refreshExams(nextClassId = classId) {
    const rows = await marksApi.exams(nextClassId || undefined);
    setExams(rows);
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
      marks: Number(marks[student.id] ?? "")
    }));
    if (results.some((result) => Number.isNaN(result.marks) || result.marks < 0 || result.marks > numericMax)) {
      setError("Enter valid marks for every student. Marks cannot exceed max marks.");
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
        maxMarks: numericMax,
        date,
        results
      });
      setExams((current) => [created, ...current.filter((exam) => exam.id !== created.id)]);
      setMarks(Object.fromEntries(students.map((student) => [student.id, ""])));
      setNotice("Exam marks saved for the full class.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save marks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Teacher workspace</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Exam and marks</h1>
        </div>
        <StatusPill label={`${exams.length} exams`} tone={exams.length ? "good" : "neutral"} />
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple" onSubmit={handleSubmit}>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Create exam</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Class</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                disabled={loading}
                onChange={(event) => handleClassChange(event.target.value)}
                value={classId}
              >
                {context.classes.length === 0 ? <option value="">No assigned classes</option> : null}
                {context.classes.map((classRecord) => (
                  <option key={classRecord.id} value={classRecord.id}>Class {classRecord.name}-{classRecord.section}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Exam name</span>
              <input
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Subject</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                onChange={(event) => setSubjectId(event.target.value)}
                value={subjectId}
              >
                {subjects.length === 0 ? <option value="">No subjects</option> : null}
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Max marks</span>
              <input
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                min={1}
                onChange={(event) => setMaxMarks(Number(event.target.value))}
                type="number"
                value={maxMarks}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Date</span>
              <input
                className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </label>
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
                          <input
                            className="w-24 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#0071e3]"
                            max={maxMarks}
                            min={0}
                            onChange={(event) => setMarks((current) => ({ ...current, [student.id]: event.target.value }))}
                            type="number"
                            value={marks[student.id] ?? ""}
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
            className="mt-5 w-full rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || loading || students.length === 0}
            type="submit"
          >
            {saving ? "Saving marks..." : "Bulk save marks"}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Exam history</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">Saved exams feed the Academic tab and performance rate.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="table-head">
                <tr>
                  {["Exam", "Subject", "Max", "Date", "Status", "Entered", "Pending", "Class Avg"].map((head) => (
                    <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 8 }).map((__, cell) => (
                        <td className="px-5 py-4" key={cell}><Skeleton className="h-4 w-20 rounded-md" /></td>
                      ))}
                    </tr>
                  ))
                ) : exams.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-[#86868b]" colSpan={8}>No exams saved yet.</td>
                  </tr>
                ) : (
                  exams.map((exam) => (
                    <tr className="table-row" key={exam.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#1d1d1f]">{exam.name}</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">{exam.className}</p>
                      </td>
                      <td className="px-5 py-4 text-[#6e6e73]">{exam.subject}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{exam.maxMarks}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{dateLabel(exam.date)}</td>
                      <td className="px-5 py-4"><StatusPill label={exam.status} tone={examTone(exam.status)} /></td>
                      <td className="px-5 py-4 font-semibold text-[#248a3d]">{exam.enteredCount}</td>
                      <td className="px-5 py-4 font-semibold text-[#d70015]">{exam.pendingCount}</td>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{exam.classAverage}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
