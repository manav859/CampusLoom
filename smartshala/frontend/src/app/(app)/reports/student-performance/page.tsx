"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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

function FilterIcon() {
  return (
    <span className="inline-flex w-3.5 flex-col items-end gap-[3px]" aria-hidden>
      <span className="h-[1.5px] w-3.5 rounded-full bg-current" />
      <span className="h-[1.5px] w-2.5 rounded-full bg-current" />
      <span className="h-[1.5px] w-1.5 rounded-full bg-current" />
    </span>
  );
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
  const classFilterButtonRef = useRef<HTMLButtonElement>(null);
  const classFilterPanelRef = useRef<HTMLDivElement>(null);
  const [classFilterStyle, setClassFilterStyle] = useState<CSSProperties>({});

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

  const classOptions = useMemo(
    () => Array.from(new Set(rows.map(classKey))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  function positionClassFilter(anchor = classFilterButtonRef.current) {
    const button = anchor;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(224, window.innerWidth - 16);
    const panelHeight = Math.min(248, Math.max(96, classOptions.length * 37 + 44));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const below = rect.bottom + 6;
    const top = below + panelHeight > window.innerHeight - 8
      ? Math.max(8, rect.top - panelHeight - 6)
      : below;

    setClassFilterStyle({ left, top, width });
  }

  useLayoutEffect(() => {
    if (!classFilterOpen) return;
    positionClassFilter();
  }, [classFilterOpen, classOptions.length]);

  useEffect(() => {
    if (!classFilterOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !classFilterButtonRef.current?.contains(target) &&
        !classFilterPanelRef.current?.contains(target)
      ) {
        setClassFilterOpen(false);
      }
    };
    const reposition = () => positionClassFilter();

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [classFilterOpen]);

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
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] border border-[#C9D3DE] px-3 text-[13px] font-semibold text-[#2456E6] md:hidden"
          onClick={(event) => {
            classFilterButtonRef.current = event.currentTarget;
            positionClassFilter(event.currentTarget);
            setClassFilterOpen((open) => !open);
          }}
          type="button"
        >
          Class
          {selectedClasses.length ? <span className="rounded-full bg-[#2456E6]/10 px-1.5 text-[11px]">{selectedClasses.length}</span> : null}
          <FilterIcon />
        </button>
      </div>
      <div className="hidden md:block">
        <ReportTable colSpan={6} empty={loading ? "Loading students..." : "No students found."} isEmpty={loading || pageRows.length === 0} minWidth="min-w-[820px]">
          {!loading && pageRows.length > 0 ? (
            <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Student</th>
                <th className="px-5 py-3.5 font-semibold">Admission no</th>
                <th className="px-5 py-3.5 font-semibold">
                  <span className="inline-flex">
                    <button
                      ref={classFilterButtonRef}
                      className="inline-flex items-center gap-2 font-semibold text-white"
                      onClick={(event) => {
                        classFilterButtonRef.current = event.currentTarget;
                        positionClassFilter(event.currentTarget);
                        setClassFilterOpen((open) => !open);
                      }}
                      type="button"
                    >
                      Class
                      {selectedClasses.length ? <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{selectedClasses.length}</span> : null}
                      <FilterIcon />
                    </button>
                  </span>
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
      </div>
      {classFilterOpen ? (
        <div
          className="fixed z-[220] rounded-[8px] border border-[#DCE1E8] bg-white p-2 text-[#1d1d1f] shadow-[var(--shadow-menu)]"
          ref={classFilterPanelRef}
          style={classFilterStyle}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold">Filter class</p>
            {selectedClasses.length ? (
              <button className="text-[12px] font-semibold text-[#2456E6]" onClick={() => setSelectedClasses([])} type="button">
                Clear
              </button>
            ) : null}
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {classOptions.map((option) => {
              const checked = selectedClasses.includes(option);
              return (
                <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] font-semibold hover:bg-[#F7F8FB]" key={option}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] ${checked ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#A7B0BD] bg-white"}`}>
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
                  <span className="truncate">{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-6 text-center text-[13px] text-[#86868b]">Loading students...</div>
        ) : pageRows.length === 0 ? (
          <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-6 text-center text-[13px] text-[#86868b]">No students found.</div>
        ) : (
          pageRows.map((row) => {
            const performance = overallPerformance(row);
            return (
              <article className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)]" key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#1d1d1f]">{row.fullName}</p>
                    <p className="mt-1 text-[12px] font-medium text-[#5A6573]">{row.admissionNumber} · {classKey(row)}</p>
                  </div>
                  <Link className="shrink-0 text-[13px] font-semibold text-[#2456E6]" href={`/students/${row.id}`}>View</Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="text-[12px] font-semibold text-[#86868b]">Attendance</p>
                    <p className="mt-1 font-semibold text-[#1d1d1f]">{percent(row.attendancePercentage)}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#86868b]">Performance</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#1d1d1f]">{performance.value}</span>
                      <StatusPill label={performance.classification} tone={performanceTone(performance.classification)} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
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
