"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  { value: "CLASS_TEST", label: "Class Test" },
  { value: "MID_TERM", label: "Mid-Term" },
  { value: "FINAL", label: "Final" },
  { value: "TERM_1", label: "Term 1" },
  { value: "TERM_2", label: "Term 2" }
];

function examTermLabel(term: MarksExam["term"]) {
  return examTermOptions.find((option) => option.value === term)?.label ?? term;
}

function examStatusLabel(status: MarksExam["status"]) {
  return status === "MARKS_ENTERED" ? "Marks entered" : "Scheduled";
}

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  return (
    <div className="flex flex-col -space-y-1">
      <svg
        className={`h-2.5 w-2.5 ${active && direction === "asc" ? "text-[#2456E6]" : "text-[#86868b]"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="3"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
      </svg>
      <svg
        className={`h-2.5 w-2.5 ${active && direction === "desc" ? "text-[#2456E6]" : "text-[#86868b]"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="3"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
  );
}

function gradeColor(grade: string) {
  const g = grade.toUpperCase().trim();
  if (g === "A+" || g === "A") return "bg-[#34c759]/15 text-[#248a3d] border-[#34c759]/30";
  if (g === "B+" || g === "B") return "bg-[#007aff]/15 text-[#0055b3] border-[#007aff]/30";
  if (g === "C+" || g === "C") return "bg-[#ff9500]/15 text-[#b36800] border-[#ff9500]/30";
  if (g === "D") return "bg-[#ff6b35]/15 text-[#c44d1a] border-[#ff6b35]/30";
  if (g === "E" || g === "F" || g === "FAIL") return "bg-[#ff3b30]/15 text-[#d70015] border-[#ff3b30]/30";
  if (g === "ABSENT" || g === "ABS") return "bg-[#8e8e93]/15 text-[#636366] border-[#8e8e93]/30";
  return "bg-[#e5e5ea]/80 text-[#636366] border-[#e5e5ea]";
}

function ColumnFilter({ label, options, selected, onToggle, isOpen, onToggleOpen }: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}) {
  return (
    <div className="relative inline-flex items-center gap-1.5">
      {label}
      <button onClick={onToggleOpen} type="button" className="hover:text-[#2456E6]">
        <svg className={`h-3.5 w-3.5 ${selected.size > 0 ? "text-[#2456E6]" : "text-[#86868b]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M3 6h18M6 12h12M9 18h6" />
        </svg>
      </button>
      {selected.size > 0 ? <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2456E6] px-1 text-[9px] font-bold text-white">{selected.size}</span> : null}
      {isOpen ? (
        <div className="absolute left-0 top-8 z-40 max-h-56 min-w-[200px] overflow-auto rounded-xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
          {options.map((opt) => (
            <label className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#031526] hover:bg-[#F2F7FC] cursor-pointer" key={opt}>
              <input type="checkbox" checked={selected.has(opt)} onChange={() => onToggle(opt)} className="h-3.5 w-3.5 rounded border-gray-300 text-[#2456E6] focus:ring-[#2456E6]" />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const gradeOrder: Record<string, number> = { "A+": 1, A: 2, "B+": 3, B: 4, "C+": 5, C: 6, D: 7, E: 8, F: 9, FAIL: 10 };
const DETAIL_PAGE_SIZE = 20;

export default function AdminExamsPage() {
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [termPickerOpen, setTermPickerOpen] = useState(false);

  // Exam history column filters
  const [filterClassNames, setFilterClassNames] = useState<Set<string>>(new Set());
  const [filterSubjectNames, setFilterSubjectNames] = useState<Set<string>>(new Set());
  const [filterExamNamesSet, setFilterExamNamesSet] = useState<Set<string>>(new Set());
  const [classColOpen, setClassColOpen] = useState(false);
  const [subjectColOpen, setSubjectColOpen] = useState(false);
  const [examColOpen, setExamColOpen] = useState(false);

  // Student detail modal
  const [detailSearch, setDetailSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailSortKey, setDetailSortKey] = useState<"marks" | "grade" | "percentage" | null>(null);
  const [detailSortDir, setDetailSortDir] = useState<"asc" | "desc">("desc");

  const selectedClass = useMemo(() => context.classes.find((c) => c.id === classId) ?? null, [context.classes, classId]);
  const subjects = useMemo(() => selectedClass?.subjects ?? [], [selectedClass]);
  const selectedSubject = useMemo(() => subjects.find((s) => s.id === subjectId) ?? null, [subjectId, subjects]);
  const students = useMemo(() => selectedClass?.students ?? [], [selectedClass]);

  const [sortKey, setSortKey] = useState<"date" | "average">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (key: "date" | "average") => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const handleDetailSort = (key: "marks" | "grade" | "percentage") => {
    setDetailPage(1);
    if (detailSortKey === key) {
      setDetailSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setDetailSortKey(key);
      setDetailSortDir("desc");
    }
  };

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter((prev) => { const next = new Set(prev); next.has(value) ? next.delete(value) : next.add(value); return next; });
  };

  // Exam history column filter values
  const uniqueClassNames = useMemo(() => [...new Set(exams.map((e) => e.className))].sort(), [exams]);
  const uniqueSubjectNames = useMemo(() => [...new Set(exams.map((e) => e.subject))].sort(), [exams]);
  const uniqueExamNames = useMemo(() => [...new Set(exams.map((e) => e.name))].sort(), [exams]);

  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (filterClassNames.size > 0 && !filterClassNames.has(e.className)) return false;
      if (filterSubjectNames.size > 0 && !filterSubjectNames.has(e.subject)) return false;
      if (filterExamNamesSet.size > 0 && !filterExamNamesSet.has(e.name)) return false;
      return true;
    });
  }, [exams, filterClassNames, filterSubjectNames, filterExamNamesSet]);

  const sortedExamsByTerm = useMemo(() => {
    const grouped = new Map<MarksExam["term"], MarksExam[]>();
    filteredExams.forEach((exam) => {
      const rows = grouped.get(exam.term) ?? [];
      rows.push(exam);
      grouped.set(exam.term, rows);
    });

    return examTermOptions
      .map((option) => {
        const groupExams = grouped.get(option.value) ?? [];
        const sorted = [...groupExams].sort((a, b) => {
          if (sortKey === "date") {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
          } else {
            const avgA = a.classAverage ?? 0;
            const avgB = b.classAverage ?? 0;
            return sortDirection === "asc" ? avgA - avgB : avgB - avgA;
          }
        });
        return { ...option, exams: sorted };
      })
      .filter((group) => group.exams.length > 0);
  }, [filteredExams, sortKey, sortDirection]);

  // Student detail modal processing
  const processedStudents = useMemo(() => {
    if (!selectedExam) return [];
    let list = [...selectedExam.students];
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      list = list.filter((s) => s.fullName.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q));
    }
    if (detailSortKey) {
      list.sort((a, b) => {
        let cmp = 0;
        if (detailSortKey === "marks") {
          cmp = (a.result?.marks ?? -1) - (b.result?.marks ?? -1);
        } else if (detailSortKey === "percentage") {
          cmp = (a.result?.percentage ?? -1) - (b.result?.percentage ?? -1);
        } else if (detailSortKey === "grade") {
          const ga = a.result ? (gradeOrder[a.result.grade] ?? 10) : 99;
          const gb = b.result ? (gradeOrder[b.result.grade] ?? 10) : 99;
          cmp = ga - gb;
        }
        return detailSortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [selectedExam, detailSearch, detailSortKey, detailSortDir]);

  const totalDetailPages = Math.ceil(processedStudents.length / DETAIL_PAGE_SIZE);
  const pagedStudents = processedStudents.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

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
        if (firstClass) {
          setClassId(firstClass.id);
          setSubjectId(firstClass.subjects?.[0]?.id ?? "");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load exams module");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const nextClass = context.classes.find((c) => c.id === classId);
    setSubjectId(nextClass?.subjects?.[0]?.id ?? "");
    setMarks(Object.fromEntries((nextClass?.students ?? []).map((s) => [s.id, ""])));
    setAbsent(Object.fromEntries((nextClass?.students ?? []).map((s) => [s.id, false])));
  }, [classId, context.classes]);

  async function refreshExams() {
    const rows = await marksApi.exams();
    setExams(rows);
  }

  async function openExam(examId: string) {
    setLoadingExamId(examId);
    setError("");
    setDetailSearch("");
    setDetailPage(1);
    setDetailSortKey(null);
    setDetailSortDir("desc");
    try {
      const detail = await marksApi.exam(examId);
      setSelectedExam(detail);
      setExamDrafts(
        Object.fromEntries(
          detail.students.map((s) => [
            s.studentId,
            s.result && !s.result.isAbsent ? String(s.result.marks) : ""
          ])
        )
      );
      setDraftAbsent(
        Object.fromEntries(
          detail.students.map((s) => [
            s.studentId,
            s.result ? s.result.isAbsent : false
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load exam students");
    } finally {
      setLoadingExamId("");
    }
  }

  function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
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

    const results = students.map((s) => ({
      studentId: s.id,
      marks: Number(marks[s.id] ?? ""),
      isAbsent: absent[s.id] ?? false
    }));
    if (results.some((r) => !r.isAbsent && (Number.isNaN(r.marks) || r.marks < 0 || r.marks > numericMax))) {
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
      setExams((current) => [created, ...current.filter((e) => e.id !== created.id)]);
      await openExam(created.id);
      setMarks(Object.fromEntries(students.map((s) => [s.id, ""])));
      setAbsent(Object.fromEntries(students.map((s) => [s.id, false])));
      setNotice("Exam marks saved for the full class.");
      setCreateModalOpen(false);
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
      setExams((current) => current.map((e) => (e.id === detail.id ? detail : e)));
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Admin workspace</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Exams &amp; Marks</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <StatusPill label={`${filteredExams.length} exams`} tone={filteredExams.length ? "good" : "neutral"} />
          <button
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[#2456E6] px-5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,20,25,0.08)] transition hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={() => setCreateModalOpen(true)}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Create Exam
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      {/* Create Exam Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="xl"
        title="Create Exam"
        description={selectedClass ? `Class ${selectedClass.name}-${selectedClass.section} | ${selectedSubject?.name ?? "No subject"} | ${students.length} students` : "Create an exam and enter marks for the full class."}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Class picker */}
              <div className="relative">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Class</span>
                <button
                  className="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading}
                  onClick={() => { setClassPickerOpen(!classPickerOpen); setSubjectPickerOpen(false); }}
                  type="button"
                >
                  <span>{selectedClass ? `Class ${selectedClass.name}-${selectedClass.section}` : context.classes.length === 0 ? "No classes available" : "Select a class"}</span>
                  <svg className={`h-4 w-4 text-[#52687D] transition ${classPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                </button>
                {classPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[76px] z-30 max-h-72 overflow-auto rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                    {context.classes.length === 0 ? (
                      <div className="rounded-xl bg-[#F7F8FB] px-3 py-3 text-[13px] font-semibold text-[#86868b]">No classes available</div>
                    ) : (
                      context.classes.map((c) => (
                        <button
                          className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${c.id === classId ? "bg-[#2456E6] text-white" : "text-[#031526] hover:bg-[#F2F7FC]"}`}
                          key={c.id}
                          onClick={() => { setClassPickerOpen(false); handleClassChange(c.id); }}
                          type="button"
                        >
                          Class {c.name}-{c.section} ({c.students.length} students)
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {/* Subject picker */}
              <div className="relative">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Subject</span>
                <button
                  className="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={subjects.length === 0}
                  onClick={() => { setSubjectPickerOpen(!subjectPickerOpen); setClassPickerOpen(false); }}
                  type="button"
                >
                  <span>{selectedSubject?.name ?? "No subjects"}</span>
                  <svg className={`h-4 w-4 text-[#52687D] transition ${subjectPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                </button>
                {subjectPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[76px] z-30 max-h-72 overflow-auto rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                    {subjects.map((s) => (
                      <button
                        className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${s.id === subjectId ? "bg-[#2456E6] text-white" : "text-[#031526] hover:bg-[#F2F7FC]"}`}
                        key={s.id}
                        onClick={() => { setSubjectPickerOpen(false); setSubjectId(s.id); }}
                        type="button"
                      >
                        {s.name}
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
                  onChange={(e) => setName(e.target.value)}
                  value={name}
                />
              </label>

              {/* Term picker */}
              <div className="relative">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Term / type</span>
                <button
                  className="mt-1.5 flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#C9D3DE] bg-white px-3 text-left text-[13px] font-semibold text-[#1d1d1f] outline-none transition hover:border-[#2456E6] focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10"
                  onClick={() => setTermPickerOpen(!termPickerOpen)}
                  type="button"
                >
                  <span>{examTermLabel(term)}</span>
                  <svg className={`h-4 w-4 text-[#52687D] transition ${termPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                </button>
                {termPickerOpen ? (
                  <div className="absolute left-0 right-0 top-[76px] z-30 overflow-hidden rounded-2xl border border-[#C9D3DE] bg-white p-2 shadow-[0_8px_24px_rgba(15,20,25,0.18)]">
                    {examTermOptions.map((option) => (
                      <button
                        className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${option.value === term ? "bg-[#2456E6] text-white" : "text-[#031526] hover:bg-[#F2F7FC]"}`}
                        key={option.value}
                        onClick={() => { setTermPickerOpen(false); setTerm(option.value); }}
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
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  type="number"
                  value={maxMarks}
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Passing marks (Opt)</span>
                <input
                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#C9D3DE] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                  min={0}
                  onChange={(e) => setPassingMarks(e.target.value)}
                  type="number"
                  value={passingMarks}
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {renderDatePicker()}
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Description (Opt)</span>
                <input
                  className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#C9D3DE] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] outline-none focus:border-[#2456E6]"
                  onChange={(e) => setDescription(e.target.value)}
                  value={description}
                />
              </label>
            </div>
          </div>

          {/* Marks entry table */}
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
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-12 rounded-md" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-20 rounded-md" /></td>
                      </tr>
                    ))
                  ) : students.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-[#86868b]" colSpan={3}>
                        {context.classes.length === 0
                          ? "No classes found. Ensure classes are created in the system."
                          : "No students in this class."}
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => (
                      <tr className="table-row" key={s.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#1d1d1f]">{s.fullName}</p>
                          <p className="mt-0.5 text-[12px] text-[#86868b]">Roll {s.rollNumber ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={absent[s.id] ?? false}
                              onChange={(e) => setAbsent((c) => ({ ...c, [s.id]: e.target.checked }))}
                              className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                            />
                            <span className="text-[13px] font-medium text-[#86868b]">Absent</span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="w-24 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#0071e3] disabled:bg-gray-100 disabled:opacity-50"
                            disabled={absent[s.id]}
                            max={maxMarks}
                            min={0}
                            onChange={(e) => setMarks((c) => ({ ...c, [s.id]: e.target.value }))}
                            type="number"
                            value={absent[s.id] ? "" : (marks[s.id] ?? "")}
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
            {saving ? "Saving marks..." : "Save exam & marks"}
          </button>
        </form>
      </Modal>

      {/* Exam history section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
          <div>
            <h2 className="text-[20px] font-semibold text-[#031526]">Exam history</h2>
            <p className="mt-0.5 text-[14px] font-medium text-[#52687D]">Saved exams feed the Academic tab and performance reports.</p>
          </div>
          {(filterClassNames.size > 0 || filterSubjectNames.size > 0 || filterExamNamesSet.size > 0) ? (
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[12px] font-semibold text-[#52687D] hover:bg-[#F7F8FB]"
              onClick={() => { setFilterClassNames(new Set()); setFilterSubjectNames(new Set()); setFilterExamNamesSet(new Set()); }}
              type="button"
            >
              Clear filters
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          ) : null}
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4" key={i}>
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="mt-3 h-3 w-28 rounded-md" />
                <Skeleton className="mt-4 h-9 w-full rounded-md" />
              </div>
            ))
          ) : filteredExams.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] px-4 py-8 text-center text-[13px] font-medium text-[#52687D]">
              No exams found.
            </div>
          ) : (
            sortedExamsByTerm.map((group) => (
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

        {/* Desktop table */}
        <div className="hidden max-h-[520px] overflow-auto rounded-[8px] border border-[#C9D3DE] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)] [contain:content] md:block">
          <table className="w-full min-w-[1120px] border-collapse text-left text-[14px] text-[#001B33]">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr className="table-head-row">
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-5 py-4 text-[14px] font-semibold">
                  <ColumnFilter label="Exam" options={uniqueExamNames} selected={filterExamNamesSet} onToggle={(v) => toggleFilter(setFilterExamNamesSet, v)} isOpen={examColOpen} onToggleOpen={() => { setExamColOpen((o) => !o); setClassColOpen(false); setSubjectColOpen(false); }} />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">
                  <ColumnFilter label="Class" options={uniqueClassNames} selected={filterClassNames} onToggle={(v) => toggleFilter(setFilterClassNames, v)} isOpen={classColOpen} onToggleOpen={() => { setClassColOpen((o) => !o); setExamColOpen(false); setSubjectColOpen(false); }} />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">
                  <ColumnFilter label="Subject" options={uniqueSubjectNames} selected={filterSubjectNames} onToggle={(v) => toggleFilter(setFilterSubjectNames, v)} isOpen={subjectColOpen} onToggleOpen={() => { setSubjectColOpen((o) => !o); setExamColOpen(false); setClassColOpen(false); }} />
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Max</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">
                  <button className="inline-flex items-center gap-1.5 hover:text-[#2456E6]" onClick={() => handleSort("date")} type="button">
                    Date <SortIcon active={sortKey === "date"} direction={sortDirection} />
                  </button>
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Status</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center text-[14px] font-semibold">Entered</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center text-[14px] font-semibold">Pending</th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center text-[14px] font-semibold">
                  <button className="inline-flex items-center gap-1.5 hover:text-[#2456E6] mx-auto" onClick={() => handleSort("average")} type="button">
                    Avg <SortIcon active={sortKey === "average"} direction={sortDirection} />
                  </button>
                </th>
                <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-[14px] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td className="border-b border-[#C9D3DE] px-4 py-5" key={j}><Skeleton className="h-4 w-20 rounded-md" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-[#52687D]" colSpan={10}>No exams found.</td>
                </tr>
              ) : (
                sortedExamsByTerm.map((group) => (
                  <Fragment key={group.value}>
                    <tr>
                      <td className="border-b border-[#C9D3DE] bg-[#F7F8FB] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#52687D]" colSpan={10}>
                        {group.label}
                      </td>
                    </tr>
                    {group.exams.map((exam) => (
                      <tr key={exam.id}>
                        <td className="border-b border-[#C9D3DE] px-5 py-4 align-middle">
                          <p className="truncate font-semibold text-[#1d1d1f]">{exam.name}</p>
                        </td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle text-[#52687D]">{exam.className}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle text-[#52687D]">{exam.subject}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle text-[#52687D]">{exam.maxMarks}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle text-[#52687D]">{formatDateShort(exam.date)}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 align-middle"><StatusPill label={examStatusLabel(exam.status)} tone={examTone(exam.status)} /></td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center align-middle font-semibold text-[#248a3d]">{exam.enteredCount}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center align-middle font-semibold text-[#d70015]">{exam.pendingCount}</td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-4 text-center align-middle font-semibold text-[#1d1d1f]">{exam.classAverage}%</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 align-middle">
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
      </section>

      {/* Student marks detail Modal */}
      <Modal
        isOpen={!!selectedExam}
        onClose={() => setSelectedExam(null)}
        size="xl"
        title="Student Marks"
        description={selectedExam ? `${selectedExam.name} | ${examTermLabel(selectedExam.term)} | ${selectedExam.className} | ${selectedExam.subject} | Max ${selectedExam.maxMarks}` : ""}
      >
        {selectedExam ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusPill label={`${selectedExam.enteredCount} entered`} tone="good" />
              <StatusPill label={`${selectedExam.pendingCount} pending`} tone={selectedExam.pendingCount ? "danger" : "neutral"} />
              <StatusPill label={`${selectedExam.classAverage}% avg`} tone="neutral" />
              <div className="ml-auto flex items-center gap-2 rounded-lg border border-[#C9D3DE] bg-white px-3 py-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" /></svg>
                <input
                  className="w-40 border-0 bg-transparent text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:text-[#86868b]"
                  onChange={(e) => { setDetailSearch(e.target.value); setDetailPage(1); }}
                  placeholder="Search student..."
                  value={detailSearch}
                />
              </div>
            </div>

            {/* Mobile student cards */}
            <div className="space-y-3 md:hidden max-h-[60vh] overflow-y-auto p-1">
              {pagedStudents.map((student) => {
                const draft = examDrafts[student.studentId] ?? "";
                const isAbsent = draftAbsent[student.studentId] ?? false;
                const savingRow = savingStudentId === student.studentId;

                return (
                  <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4" key={student.studentId}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/students/${student.studentId}`} className="truncate font-semibold text-[#1d1d1f] hover:text-[#2456E6] block">{student.fullName}</Link>
                        <p className="mt-1 text-[12px] text-[#86868b]">Roll {student.rollNumber ?? "-"} | <span className="type-code">{student.admissionNumber}</span></p>
                      </div>
                      {student.result ? <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${gradeColor(student.result.grade)}`}>{student.result.grade}</span> : <StatusPill label="Pending" tone="danger" />}
                    </div>
                    <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAbsent}
                          onChange={(e) => setDraftAbsent((c) => ({ ...c, [student.studentId]: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                        />
                        <span className="text-[12px] font-medium text-[#86868b]">Absent</span>
                      </label>
                      <input
                        className="min-h-10 rounded-lg border border-[rgba(0,0,0,0.08)] px-3 text-[13px] font-semibold outline-none focus:border-[#0071e3] disabled:bg-gray-100 disabled:opacity-50"
                        disabled={isAbsent}
                        max={selectedExam.maxMarks}
                        min={0}
                        onChange={(e) => setExamDrafts((c) => ({ ...c, [student.studentId]: e.target.value }))}
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

            {/* Desktop student table */}
            <div className="hidden md:block max-h-[60vh] overflow-y-auto rounded-[8px] border border-[#C9D3DE] [contain:content]">
              <table className="w-full min-w-[720px] border-collapse text-left text-[14px] text-[#001B33]">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr className="table-head-row">
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-3.5 text-[14px] font-semibold">Student</th>
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-3.5 text-[14px] font-semibold">Admission</th>
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-3 py-3.5 text-[14px] font-semibold text-center">Roll</th>
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-3.5 text-[14px] font-semibold">
                      <button className="inline-flex items-center gap-1.5 hover:text-[#2456E6]" onClick={() => handleDetailSort("marks")} type="button">
                        Marks <SortIcon active={detailSortKey === "marks"} direction={detailSortDir} />
                      </button>
                    </th>
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-3.5 text-[14px] font-semibold text-center">
                      <button className="inline-flex items-center gap-1.5 hover:text-[#2456E6] mx-auto" onClick={() => handleDetailSort("percentage")} type="button">
                        Percentage <SortIcon active={detailSortKey === "percentage"} direction={detailSortDir} />
                      </button>
                    </th>
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-3.5 text-[14px] font-semibold text-center">
                      <button className="inline-flex items-center gap-1.5 hover:text-[#2456E6] mx-auto" onClick={() => handleDetailSort("grade")} type="button">
                        Grade <SortIcon active={detailSortKey === "grade"} direction={detailSortDir} />
                      </button>
                    </th>
                    <th className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-3.5 text-[14px] font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStudents.map((student) => {
                    const draft = examDrafts[student.studentId] ?? "";
                    const isAbsent = draftAbsent[student.studentId] ?? false;
                    const savingRow = savingStudentId === student.studentId;

                    return (
                      <tr className="table-row hover:bg-[#F2F7FC]/30 transition" key={student.studentId}>
                        <td className="border-b border-[#C9D3DE] px-4 py-3 align-middle">
                          <Link href={`/students/${student.studentId}`} className="font-semibold text-[#1d1d1f] hover:text-[#2456E6]">{student.fullName}</Link>
                        </td>
                        <td className="border-b border-[#C9D3DE] px-4 py-3 align-middle type-code text-[#6e6e73]">{student.admissionNumber}</td>
                        <td className="border-b border-[#C9D3DE] px-3 py-3 align-middle text-[#6e6e73] text-center">{student.rollNumber ?? "-"}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={isAbsent}
                                onChange={(e) => setDraftAbsent((c) => ({ ...c, [student.studentId]: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                              />
                              <span className="text-[12px] font-medium text-[#86868b]">Abs</span>
                            </label>
                            <input
                              className="w-20 rounded-lg border border-[rgba(0,0,0,0.08)] px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-[#0071e3] disabled:bg-gray-100 disabled:opacity-50"
                              disabled={isAbsent}
                              max={selectedExam.maxMarks}
                              min={0}
                              onChange={(e) => setExamDrafts((c) => ({ ...c, [student.studentId]: e.target.value }))}
                              type="number"
                              value={isAbsent ? "" : draft}
                            />
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-3 align-middle font-semibold text-[#1d1d1f] text-center">
                          {student.result ? `${student.result.percentage}%` : "-"}
                        </td>
                        <td className="border-b border-[#C9D3DE] px-4 py-3 align-middle text-center">
                          {student.result ? <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${gradeColor(student.result.grade)}`}>{student.result.grade}</span> : <StatusPill label="Pending" tone="danger" />}
                        </td>
                        <td className="border-b border-[#C9D3DE] px-4 py-3 align-middle">
                          <button
                            className="rounded-[5px] border border-[#C9D3DE] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] transition hover:bg-[#F2F7FC] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={savingRow}
                            onClick={() => updateStudentMark(student.studentId)}
                            type="button"
                          >
                            {savingRow ? "Saving..." : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalDetailPages > 1 ? (
              <div className="flex items-center justify-between pt-2">
                <p className="text-[12px] font-medium text-[#86868b]">
                  Showing {(detailPage - 1) * DETAIL_PAGE_SIZE + 1}–{Math.min(detailPage * DETAIL_PAGE_SIZE, processedStudents.length)} of {processedStudents.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#C9D3DE] bg-white text-[#52687D] hover:bg-[#F2F7FC] disabled:opacity-40"
                    disabled={detailPage <= 1}
                    onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                  </button>
                  <span className="min-w-[48px] text-center text-[12px] font-semibold text-[#1d1d1f]">{detailPage} / {totalDetailPages}</span>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#C9D3DE] bg-white text-[#52687D] hover:bg-[#F2F7FC] disabled:opacity-40"
                    disabled={detailPage >= totalDetailPages}
                    onClick={() => setDetailPage((p) => Math.min(totalDetailPages, p + 1))}
                    type="button"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
