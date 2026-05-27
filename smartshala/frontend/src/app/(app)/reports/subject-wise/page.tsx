"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { marksApi, type MarksExam, type MarksExamDetail } from "@/lib/api";
import { downloadCsv, percent, ReportTable } from "@/features/reports/reportUtils";

type StudentSubjectRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  subject: string;
  exams: number;
  attempted: number;
  pending: number;
  totalPercentage: number;
  bestPercentage: number | null;
  latestExam: string;
  latestDate: string;
  latestGrade: string;
};

type FilterKey = "class" | "subject" | "status";
type SortState = { key: "average" | "best"; direction: "asc" | "desc" } | null;

function statusFor(avg: number | null) {
  if (avg === null) return { label: "Pending", tone: "warn" as const };
  if (avg >= 85) return { label: "Excellent", tone: "good" as const };
  if (avg >= 70) return { label: "Good", tone: "good" as const };
  if (avg >= 50) return { label: "Needs Attention", tone: "warn" as const };
  return { label: "At Risk", tone: "danger" as const };
}

function average(row: StudentSubjectRow) {
  return row.attempted ? row.totalPercentage / row.attempted : null;
}

function FilterIcon() {
  return (
    <span className="inline-flex w-3.5 flex-col items-end gap-[3px]" aria-hidden>
      <span className="h-[1.5px] w-3.5 rounded-full bg-current" />
      <span className="h-[1.5px] w-2.5 rounded-full bg-current" />
      <span className="h-[1.5px] w-1.5 rounded-full bg-current" />
    </span>
  );
}

function optionToggle(current: string[], option: string) {
  return current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
}

export default function SubjectWiseReportPage() {
  const [exams, setExams] = useState<MarksExam[]>([]);
  const [details, setDetails] = useState<MarksExamDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const filterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const examRows = await marksApi.exams();
        const enteredExams = examRows.filter((exam) => exam.enteredCount > 0 || exam.pendingCount > 0);
        const detailRows = await Promise.all(enteredExams.map((exam) => marksApi.exam(exam.id)));
        if (!active) return;
        setExams(examRows);
        setDetails(detailRows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load subject wise student performance");
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
    if (!openFilter) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !filterRef.current?.contains(target)) {
        setOpenFilter(null);
      }
    };

    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openFilter]);

  const rows = useMemo(() => {
    const map = new Map<string, StudentSubjectRow>();

    for (const exam of details) {
      for (const student of exam.students) {
        const key = `${student.studentId}:${exam.className}:${exam.subject}`;
        const current = map.get(key) ?? {
          studentId: student.studentId,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          className: exam.className,
          subject: exam.subject,
          exams: 0,
          attempted: 0,
          pending: 0,
          totalPercentage: 0,
          bestPercentage: null,
          latestExam: "-",
          latestDate: "",
          latestGrade: "-"
        };

        current.exams += 1;
        if (student.result) {
          current.attempted += 1;
          current.totalPercentage += student.result.percentage;
          current.bestPercentage = Math.max(current.bestPercentage ?? 0, student.result.percentage);
          if (!current.latestDate || exam.date >= current.latestDate) {
            current.latestDate = exam.date;
            current.latestExam = exam.name;
            current.latestGrade = student.result.grade;
          }
        } else {
          current.pending += 1;
        }

        map.set(key, current);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const classCompare = a.className.localeCompare(b.className);
      if (classCompare) return classCompare;
      const subjectCompare = a.subject.localeCompare(b.subject);
      if (subjectCompare) return subjectCompare;
      return a.studentName.localeCompare(b.studentName);
    });
  }, [details]);

  const classOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.className))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const subjectOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.subject))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => statusFor(average(row)).label))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const result = rows.filter((row) => {
      const statusLabel = statusFor(average(row)).label;
      return (
        (selectedClasses.length === 0 || selectedClasses.includes(row.className)) &&
        (selectedSubjects.length === 0 || selectedSubjects.includes(row.subject)) &&
        (selectedStatuses.length === 0 || selectedStatuses.includes(statusLabel))
      );
    });

    if (!sort) return result;

    return [...result].sort((left, right) => {
      const leftValue = sort.key === "average" ? average(left) : left.bestPercentage;
      const rightValue = sort.key === "average" ? average(right) : right.bestPercentage;
      const comparison = (leftValue ?? -1) - (rightValue ?? -1) || left.studentName.localeCompare(right.studentName);
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [rows, selectedClasses, selectedSubjects, selectedStatuses, sort]);

  function toggleSort(key: "average" | "best") {
    setSort((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  function renderFilter(key: FilterKey, label: string, options: string[], selected: string[], setSelected: (next: string[]) => void) {
    const open = openFilter === key;
    return (
      <span className="relative inline-flex" ref={open ? filterRef : undefined}>
        <button className="inline-flex items-center gap-2 font-semibold text-white" onClick={() => setOpenFilter((current) => (current === key ? null : key))} type="button">
          {label}
          {selected.length ? <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{selected.length}</span> : null}
          <FilterIcon />
        </button>
        {open ? (
          <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-56 rounded-[8px] border border-[#DCE1E8] bg-white p-2 text-[#1d1d1f] shadow-[var(--shadow-menu)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold">Filter {label.toLowerCase()}</p>
              {selected.length ? (
                <button className="text-[12px] font-semibold text-[#2456E6]" onClick={() => setSelected([])} type="button">
                  Clear
                </button>
              ) : null}
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {options.map((option) => {
                const checked = selected.includes(option);
                return (
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] font-semibold hover:bg-[#F7F8FB]" key={option}>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] ${checked ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#A7B0BD] bg-white"}`}>
                      {checked ? <span>&#10003;</span> : null}
                    </span>
                    <input checked={checked} className="sr-only" onChange={() => setSelected(optionToggle(selected, option))} type="checkbox" />
                    <span className="truncate">{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </span>
    );
  }

  function exportCsv() {
    downloadCsv(`student-subject-performance-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Student", "Admission no", "Class", "Subject", "Exams", "Attempted", "Pending", "Average", "Best", "Latest exam", "Grade", "Status"],
      ...filteredRows.map((row) => {
        const avg = average(row);
        return [
          row.studentName,
          row.admissionNumber,
          row.className,
          row.subject,
          row.exams,
          row.attempted,
          row.pending,
          percent(avg),
          percent(row.bestPercentage),
          row.latestExam,
          row.latestGrade,
          statusFor(avg).label
        ];
      })
    ]);
  }

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Subject wise student performance"
        action={<button className="btn-primary min-h-10 px-4 text-[13px]" disabled={loading || rows.length === 0} onClick={exportCsv} type="button">Export CSV</button>}
      />
      <ReportTable colSpan={12} empty={loading ? "Loading student subject performance..." : exams.length === 0 ? "No exams available." : "No marks available."} isEmpty={loading || filteredRows.length === 0} minWidth="min-w-[1200px] table-fixed">
        {!loading && filteredRows.length > 0 ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Admission no</th>
                <th className="px-3 py-3.5 font-semibold">{renderFilter("class", "Class", classOptions, selectedClasses, setSelectedClasses)}</th>
                <th className="px-3 py-3.5 font-semibold">{renderFilter("subject", "Subject", subjectOptions, selectedSubjects, setSelectedSubjects)}</th>
                <th className="px-5 py-3.5 font-semibold">Exams</th>
                <th className="px-5 py-3.5 font-semibold">Attempted</th>
                <th className="px-5 py-3.5 font-semibold">Pending</th>
                <th className="px-3 py-3.5 font-semibold">
                  <button className="inline-flex items-center gap-2 font-semibold text-white" onClick={() => toggleSort("average")} type="button">
                    Average
                    <span className="inline-flex gap-0.5 text-[12px]" aria-hidden>
                      <span className={sort?.key === "average" && sort.direction === "asc" ? "text-white" : "text-white/55"}>&uarr;</span>
                      <span className={sort?.key === "average" && sort.direction === "desc" ? "text-white" : "text-white/55"}>&darr;</span>
                    </span>
                  </button>
                </th>
                <th className="px-3 py-3.5 font-semibold">
                  <button className="inline-flex items-center gap-2 font-semibold text-white" onClick={() => toggleSort("best")} type="button">
                    Best
                    <span className="inline-flex gap-0.5 text-[12px]" aria-hidden>
                      <span className={sort?.key === "best" && sort.direction === "asc" ? "text-white" : "text-white/55"}>&uarr;</span>
                      <span className={sort?.key === "best" && sort.direction === "desc" ? "text-white" : "text-white/55"}>&darr;</span>
                    </span>
                  </button>
                </th>
                <th className="px-5 py-3.5 font-semibold">Latest exam</th>
                <th className="px-5 py-3.5 font-semibold">Grade</th>
                <th className="px-3 py-3.5 font-semibold">{renderFilter("status", "Status", statusOptions, selectedStatuses, setSelectedStatuses)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {filteredRows.map((row) => {
                const avg = average(row);
                const status = statusFor(avg);
                return (
                  <tr className="table-row" key={`${row.studentId}-${row.className}-${row.subject}`}>
                    <td className="truncate px-3 py-4 font-semibold text-[#1d1d1f]" title={row.studentName}>
                      <Link className="hover:text-[#2456E6]" href={`/students/${row.studentId}`}>{row.studentName}</Link>
                    </td>
                    <td className="truncate px-3 py-4 text-[#5A6573]" title={row.admissionNumber}>{row.admissionNumber}</td>
                    <td className="truncate px-3 py-4 text-[#5A6573]" title={row.className}>{row.className}</td>
                    <td className="truncate px-3 py-4 font-semibold text-[#1d1d1f]" title={row.subject}>{row.subject}</td>
                    <td className="px-3 py-4 text-[#5A6573]">{row.exams}</td>
                    <td className="px-3 py-4 text-[#5A6573]">{row.attempted}</td>
                    <td className="px-3 py-4 text-[#5A6573]">{row.pending}</td>
                    <td className="px-3 py-4 text-[#5A6573]">{percent(avg)}</td>
                    <td className="px-3 py-4 text-[#5A6573]">{percent(row.bestPercentage)}</td>
                    <td className="truncate px-3 py-4 text-[#5A6573]" title={row.latestExam}>{row.latestExam}</td>
                    <td className="px-3 py-4 text-[#5A6573]">{row.latestGrade}</td>
                    <td className="px-3 py-4"><StatusPill label={status.label} tone={status.tone} /></td>
                  </tr>
                );
              })}
            </tbody>
          </>
        ) : null}
      </ReportTable>
    </div>
  );
}
