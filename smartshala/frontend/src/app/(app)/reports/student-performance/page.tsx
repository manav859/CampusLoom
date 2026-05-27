"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch } from "@/lib/api";
import { downloadCsv, percent, ReportTable } from "@/features/reports/reportUtils";

type PerformanceClassification = "Excellent" | "Good" | "Needs Attention" | "At Risk";

type StudentPerformanceRow = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  attendancePercentage?: number | null;
  performanceRate?: number | null;
  performanceClassification?: PerformanceClassification | null;
  pendingAmount?: number | null;
  feeBalance?: number | null;
  isActive: boolean;
};

type StudentsResponse = {
  items: StudentPerformanceRow[];
  total: number;
  page: number;
  limit: number;
};

function performanceTone(label: PerformanceClassification | null | undefined) {
  if (label === "Excellent" || label === "Good") return "good";
  if (label === "Needs Attention") return "warn";
  if (label === "At Risk") return "danger";
  return "neutral";
}

function performanceClassification(rate: number | null | undefined): PerformanceClassification | null {
  if (rate === null || rate === undefined) return null;
  if (rate >= 85) return "Excellent";
  if (rate >= 70) return "Good";
  if (rate >= 50) return "Needs Attention";
  return "At Risk";
}

function fallbackPerformanceClassification(attendancePercentage: number | null | undefined, feeBalance: number | null | undefined): PerformanceClassification {
  const attendance = attendancePercentage ?? 0;
  const fees = feeBalance ?? 0;
  if ((attendance > 0 && attendance < 75) || fees > 0) return "At Risk";
  if (attendance > 0 && attendance < 85) return "Needs Attention";
  return "Good";
}

function overallPerformance(row: StudentPerformanceRow) {
  return {
    value: row.performanceRate === null || row.performanceRate === undefined ? "No data" : percent(row.performanceRate),
    classification:
      row.performanceClassification ??
      performanceClassification(row.performanceRate) ??
      fallbackPerformanceClassification(row.attendancePercentage, row.feeBalance ?? row.pendingAmount)
  };
}

function classKey(row: StudentPerformanceRow) {
  return `${row.class.name}-${row.class.section}`;
}

export default function StudentPerformanceReportPage() {
  const [rows, setRows] = useState<StudentPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [classFilterOpen, setClassFilterOpen] = useState(false);
  const classFilterRef = useRef<HTMLDivElement>(null);

  const perPage = 20;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const firstParams = new URLSearchParams({ limit: "100", page: "1" });
        const firstPage = await apiFetch<StudentsResponse>(`/students?${firstParams.toString()}`);
        const totalPages = Math.max(1, Math.ceil((firstPage.total ?? firstPage.items.length) / firstPage.limit));
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => {
            const params = new URLSearchParams({ limit: "100", page: String(index + 2) });
            return apiFetch<StudentsResponse>(`/students?${params.toString()}`);
          })
        );
        if (active) setRows([firstPage, ...rest].flatMap((data) => data.items));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load student performance report");
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
    setPage(1);
  }, [search, selectedClasses, sortDirection]);

  useEffect(() => {
    if (!classFilterOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !classFilterRef.current?.contains(target)) {
        setClassFilterOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [classFilterOpen]);

  const classOptions = useMemo(
    () => Array.from(new Set(rows.map(classKey))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const sortedRows = useMemo(
    () => {
      const term = search.trim().toLowerCase();
      const filteredRows = term
        ? rows.filter((row) => {
            const className = classKey(row).toLowerCase();
            return (
              row.fullName.toLowerCase().includes(term) ||
              row.admissionNumber.toLowerCase().includes(term) ||
              className.includes(term)
            );
          })
        : rows;
      const filteredByClass = selectedClasses.length
        ? filteredRows.filter((row) => selectedClasses.includes(classKey(row)))
        : filteredRows;

      return [...filteredByClass].sort((a, b) => {
        const left = a.performanceRate ?? -1;
        const right = b.performanceRate ?? -1;
        const result = left - right || a.fullName.localeCompare(b.fullName);
        return sortDirection === "asc" ? result : -result;
      });
    },
    [rows, search, selectedClasses, sortDirection]
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * perPage, currentPage * perPage);
  const displayStart = pageRows.length ? (currentPage - 1) * perPage + 1 : 0;
  const displayEnd = pageRows.length ? displayStart + pageRows.length - 1 : 0;
  const pageNumbers = useMemo(() => {
    const first = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index);
  }, [currentPage, totalPages]);

  function exportCsv() {
    downloadCsv(`student-performance-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Student", "Admission no", "Class", "Attendance", "Performance", "Status"],
      ...sortedRows.map((row) => [
        row.fullName,
        row.admissionNumber,
        classKey(row),
        percent(row.attendancePercentage),
        overallPerformance(row).value,
        row.isActive ? "Active" : "Inactive"
      ])
    ]);
  }

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Student performance report"
        action={<button className="btn-primary min-h-10 px-4 text-[13px]" disabled={loading || rows.length === 0} onClick={exportCsv} type="button">Export CSV</button>}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="student-performance-search">Search student</label>
        <input
          className="min-h-11 w-full rounded-[6px] border border-[#C9D3DE] px-3 text-[14px] font-medium text-[#1d1d1f] outline-none transition focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/15 sm:max-w-md"
          id="student-performance-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search student, admission no, or class"
          type="search"
          value={search}
        />
        {search ? (
          <button className="min-h-10 rounded-[6px] border border-[#C9D3DE] px-3 text-[13px] font-semibold text-[#2456E6] hover:bg-[#F8FBFD]" onClick={() => setSearch("")} type="button">
            Clear
          </button>
        ) : null}
      </div>
      <ReportTable colSpan={6} empty={loading ? "Loading students..." : "No students found."} isEmpty={loading || pageRows.length === 0} minWidth="min-w-[820px]">
        {!loading && pageRows.length > 0 ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Admission no</th>
                <th className="px-5 py-3.5 font-semibold">
                  <button
                    className="inline-flex items-center gap-2 font-semibold text-white"
                    onClick={() => setClassFilterOpen((open) => !open)}
                    type="button"
                  >
                    Class
                    {selectedClasses.length ? <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{selectedClasses.length}</span> : null}
                    <span aria-hidden>{classFilterOpen ? "^" : "v"}</span>
                  </button>
                </th>
                <th className="px-5 py-3.5 font-semibold">Attendance</th>
                <th className="px-5 py-3.5 font-semibold">
                  <button
                    className="inline-flex items-center gap-2 font-semibold text-white"
                    onClick={() => setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))}
                    type="button"
                  >
                    Performance
                    <span className="inline-flex gap-0.5 text-[12px]" aria-hidden>
                      <span className={sortDirection === "asc" ? "text-white" : "text-white/55"}>&uarr;</span>
                      <span className={sortDirection === "desc" ? "text-white" : "text-white/55"}>&darr;</span>
                    </span>
                  </button>
                </th>
                <th className="px-5 py-3.5 font-semibold">Action</th>
              </tr>
              {classFilterOpen ? (
                <tr>
                  <td className="border-b border-[#DCE1E8] bg-white px-5 py-4 text-[#1d1d1f]" colSpan={6}>
                    <div className="flex flex-col gap-3" ref={classFilterRef}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-semibold">Filter classes</p>
                        <div className="flex items-center gap-2">
                          {selectedClasses.length ? (
                            <button className="rounded-[5px] border border-[#C9D3DE] px-2.5 py-1.5 text-[12px] font-semibold text-[#2456E6]" onClick={() => setSelectedClasses([])} type="button">
                              Clear
                            </button>
                          ) : null}
                          <button className="rounded-[5px] border border-[#C9D3DE] px-2.5 py-1.5 text-[12px] font-semibold text-[#5A6573]" onClick={() => setClassFilterOpen(false)} type="button">
                            Done
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {classOptions.map((option) => {
                          const checked = selectedClasses.includes(option);
                          return (
                            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[6px] border border-[#DCE1E8] px-3 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" key={option}>
                              <span className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${checked ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#A7B0BD] bg-white"}`}>
                                {checked ? <span>&#10003;</span> : null}
                              </span>
                              <input
                                checked={checked}
                                className="sr-only"
                                onChange={() =>
                                  setSelectedClasses((current) =>
                                    current.includes(option)
                                      ? current.filter((item) => item !== option)
                                      : [...current, option]
                                  )
                                }
                                type="checkbox"
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {pageRows.map((row) => {
                const performance = overallPerformance(row);
                return (
                  <tr className="table-row" key={row.id}>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{row.fullName}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{row.admissionNumber}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{classKey(row)}</td>
                    <td className="px-5 py-4 text-[#5A6573]">{percent(row.attendancePercentage)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="min-w-14 font-semibold text-[#1d1d1f]">{performance.value}</span>
                        <StatusPill label={performance.classification} tone={performanceTone(performance.classification)} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Link className="text-[13px] font-semibold text-[#2456E6] hover:text-[#1B45BD]" href={`/students/${row.id}`}>View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </>
        ) : null}
      </ReportTable>
      {!loading && sortedRows.length > 0 ? (
        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-[14px] font-semibold text-[#52687D] sm:text-left">
            Showing <span className="text-[#0F1419]">{displayStart}</span> to <span className="text-[#0F1419]">{displayEnd}</span> of <span className="text-[#0F1419]">{sortedRows.length}</span> students
          </p>
          <div className="flex w-full flex-nowrap items-center justify-center gap-2 overflow-x-auto sm:w-auto sm:gap-3">
            <button className="min-h-[44px] shrink-0 rounded-[5px] border border-[#C9D3DE] px-3 text-[14px] font-semibold text-[#7A8390] transition hover:bg-[#F8FBFD] disabled:opacity-50 sm:px-4" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
              Previous
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                className={`min-h-[44px] min-w-[44px] shrink-0 rounded-[5px] border px-3 text-[14px] font-semibold transition ${currentPage === pageNumber ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#C9D3DE] bg-white text-[#2456E6] hover:bg-[#F8FBFD]"}`}
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                type="button"
              >
                {pageNumber}
              </button>
            ))}
            <button className="min-h-[44px] shrink-0 rounded-[5px] border border-[#C9D3DE] px-3 text-[14px] font-semibold text-[#2456E6] transition hover:bg-[#F8FBFD] disabled:opacity-50 sm:px-4" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
