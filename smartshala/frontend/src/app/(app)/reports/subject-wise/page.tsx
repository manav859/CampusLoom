"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
  const filterButtonRefs = useRef<Record<FilterKey, HTMLButtonElement | null>>({ class: null, subject: null, status: null });
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [filterStyle, setFilterStyle] = useState<CSSProperties>({});

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

  function positionFilter(key: FilterKey, anchor = filterButtonRefs.current[key]) {
    const button = anchor;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(224, window.innerWidth - 16);
    const optionCount =
      key === "class" ? classOptions.length :
      key === "subject" ? subjectOptions.length :
      statusOptions.length;
    const panelHeight = Math.min(248, Math.max(96, optionCount * 37 + 44));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const below = rect.bottom + 6;
    const top = below + panelHeight > window.innerHeight - 8
      ? Math.max(8, rect.top - panelHeight - 6)
      : below;

    setFilterStyle({ left, top, width });
  }

  useLayoutEffect(() => {
    if (!openFilter) return;
    positionFilter(openFilter);
  }, [openFilter, classOptions.length, subjectOptions.length, statusOptions.length]);

  useEffect(() => {
    if (!openFilter) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !filterButtonRefs.current[openFilter]?.contains(target) &&
        !filterPanelRef.current?.contains(target)
      ) {
        setOpenFilter(null);
      }
    };
    const reposition = () => positionFilter(openFilter);

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [openFilter, classOptions.length, subjectOptions.length, statusOptions.length]);

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

  function renderFilter(key: FilterKey, label: string, selected: string[], dark = false) {
    return (
      <span className="inline-flex">
        <button
          className={`inline-flex items-center gap-2 font-semibold ${dark ? "text-[#2456E6]" : "text-white"}`}
          onClick={(event) => {
            filterButtonRefs.current[key] = event.currentTarget;
            positionFilter(key, event.currentTarget);
            setOpenFilter((current) => (current === key ? null : key));
          }}
          ref={(button) => {
            filterButtonRefs.current[key] = button;
          }}
          type="button"
        >
          {label}
          {selected.length ? <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{selected.length}</span> : null}
          <FilterIcon />
        </button>
      </span>
    );
  }

  const activeFilter = openFilter === "class"
    ? { label: "Class", options: classOptions, selected: selectedClasses, setSelected: setSelectedClasses }
    : openFilter === "subject"
      ? { label: "Subject", options: subjectOptions, selected: selectedSubjects, setSelected: setSelectedSubjects }
      : openFilter === "status"
        ? { label: "Status", options: statusOptions, selected: selectedStatuses, setSelected: setSelectedStatuses }
        : null;

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
      <div className="flex flex-wrap gap-2 md:hidden">
        <button className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-[#C9D3DE] px-3 text-[13px] font-semibold text-[#2456E6]" onClick={(event) => { filterButtonRefs.current.class = event.currentTarget; positionFilter("class", event.currentTarget); setOpenFilter((current) => current === "class" ? null : "class"); }} type="button">
          Class {selectedClasses.length ? <span className="rounded-full bg-[#2456E6]/10 px-1.5 text-[11px]">{selectedClasses.length}</span> : null}<FilterIcon />
        </button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-[#C9D3DE] px-3 text-[13px] font-semibold text-[#2456E6]" onClick={(event) => { filterButtonRefs.current.subject = event.currentTarget; positionFilter("subject", event.currentTarget); setOpenFilter((current) => current === "subject" ? null : "subject"); }} type="button">
          Subject {selectedSubjects.length ? <span className="rounded-full bg-[#2456E6]/10 px-1.5 text-[11px]">{selectedSubjects.length}</span> : null}<FilterIcon />
        </button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-[#C9D3DE] px-3 text-[13px] font-semibold text-[#2456E6]" onClick={(event) => { filterButtonRefs.current.status = event.currentTarget; positionFilter("status", event.currentTarget); setOpenFilter((current) => current === "status" ? null : "status"); }} type="button">
          Status {selectedStatuses.length ? <span className="rounded-full bg-[#2456E6]/10 px-1.5 text-[11px]">{selectedStatuses.length}</span> : null}<FilterIcon />
        </button>
      </div>
      <div className="hidden md:block">
        <ReportTable colSpan={12} empty={loading ? "Loading student subject performance..." : exams.length === 0 ? "No exams available." : "No marks available."} isEmpty={loading || filteredRows.length === 0} minWidth="min-w-[1200px] table-fixed">
          {!loading && filteredRows.length > 0 ? (
            <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Admission no</th>
                <th className="px-3 py-3.5 font-semibold">{renderFilter("class", "Class", selectedClasses)}</th>
                <th className="px-3 py-3.5 font-semibold">{renderFilter("subject", "Subject", selectedSubjects)}</th>
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
                <th className="px-3 py-3.5 font-semibold">{renderFilter("status", "Status", selectedStatuses)}</th>
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
      {activeFilter ? (
        <div
          className="fixed z-[220] rounded-[8px] border border-[#DCE1E8] bg-white p-2 text-[#1d1d1f] shadow-[var(--shadow-menu)]"
          ref={filterPanelRef}
          style={filterStyle}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold">Filter {activeFilter.label.toLowerCase()}</p>
            {activeFilter.selected.length ? (
              <button className="text-[12px] font-semibold text-[#2456E6]" onClick={() => activeFilter.setSelected([])} type="button">
                Clear
              </button>
            ) : null}
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {activeFilter.options.map((option) => {
              const checked = activeFilter.selected.includes(option);
              return (
                <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] font-semibold hover:bg-[#F7F8FB]" key={option}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] ${checked ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#A7B0BD] bg-white"}`}>
                    {checked ? <span>&#10003;</span> : null}
                  </span>
                  <input checked={checked} className="sr-only" onChange={() => activeFilter.setSelected(optionToggle(activeFilter.selected, option))} type="checkbox" />
                  <span className="truncate">{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-6 text-center text-[13px] text-[#86868b]">Loading student subject performance...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-6 text-center text-[13px] text-[#86868b]">{exams.length === 0 ? "No exams available." : "No marks available."}</div>
        ) : (
          filteredRows.map((row) => {
            const avg = average(row);
            const status = statusFor(avg);
            return (
              <article className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)]" key={`${row.studentId}-${row.className}-${row.subject}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="block truncate text-[15px] font-semibold text-[#1d1d1f] hover:text-[#2456E6]" href={`/students/${row.studentId}`}>{row.studentName}</Link>
                    <p className="mt-1 text-[12px] font-medium text-[#5A6573]">{row.admissionNumber} · {row.className}</p>
                  </div>
                  <StatusPill label={status.label} tone={status.tone} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="text-[12px] font-semibold text-[#86868b]">Subject</p>
                    <p className="mt-1 font-semibold text-[#1d1d1f]">{row.subject}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#86868b]">Average / Best</p>
                    <p className="mt-1 font-semibold text-[#1d1d1f]">{percent(avg)} / {percent(row.bestPercentage)}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#86868b]">Exams</p>
                    <p className="mt-1 font-semibold text-[#1d1d1f]">{row.attempted}/{row.exams} attempted</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#86868b]">Latest</p>
                    <p className="mt-1 truncate font-semibold text-[#1d1d1f]">{row.latestExam}</p>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
