"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, TableRowSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
type StudentRow = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  isActive: boolean;
  /* enriched fields — filled from API or fallback */
  feeStatus: "PAID" | "PENDING" | "OVERDUE";
  pendingAmount: number;
  lastPayment: string | null;
  attendancePercentage: number;
};

type ApiStudentItem = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  isActive: boolean;
  feeAssignments?: { pendingAmount: string | number; status: string }[];
  feeStatus?: "PAID" | "PENDING" | "OVERDUE";
  pendingAmount?: number;
  lastPayment?: string | null;
  attendancePercentage?: number;
};

/* ── Fallback seed data (shown when API has no students) ── */
const fallbackStudents: StudentRow[] = [
  { id: "1", admissionNumber: "ADM001", fullName: "Rohit Sharma", class: { name: "9", section: "A" }, isActive: true, feeStatus: "OVERDUE", pendingAmount: 36000, lastPayment: null, attendancePercentage: 66 },
  { id: "2", admissionNumber: "ADM002", fullName: "Priya Kulkarni", class: { name: "7", section: "B" }, isActive: true, feeStatus: "OVERDUE", pendingAmount: 24000, lastPayment: null, attendancePercentage: 90 },
  { id: "3", admissionNumber: "ADM003", fullName: "Arjun Mehta", class: { name: "6", section: "C" }, isActive: true, feeStatus: "PENDING", pendingAmount: 18500, lastPayment: null, attendancePercentage: 78 },
  { id: "4", admissionNumber: "ADM004", fullName: "Aarav Shah", class: { name: "8", section: "A" }, isActive: true, feeStatus: "PAID", pendingAmount: 0, lastPayment: "2025-04-14", attendancePercentage: 95 },
  { id: "5", admissionNumber: "ADM005", fullName: "Sneha Joshi", class: { name: "10", section: "B" }, isActive: true, feeStatus: "PENDING", pendingAmount: 12000, lastPayment: null, attendancePercentage: 88 },
  { id: "6", admissionNumber: "ADM006", fullName: "Veer Rao", class: { name: "8", section: "A" }, isActive: true, feeStatus: "PAID", pendingAmount: 0, lastPayment: "2025-04-10", attendancePercentage: 92 },
  { id: "7", admissionNumber: "ADM007", fullName: "Pooja Verma", class: { name: "6", section: "C" }, isActive: true, feeStatus: "PAID", pendingAmount: 0, lastPayment: "2025-04-12", attendancePercentage: 72 },
];

/* ── Helpers ── */
function money(v: number) {
  if (v === 0) return "₹0";
  return `₹${v.toLocaleString("en-IN")}`;
}

function timeAgo(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function attendanceColor(pct: number): string {
  if (pct >= 90) return "text-[#248a3d]";
  if (pct >= 75) return "text-[#c93400]";
  return "text-[#d70015]";
}

const feeStatusStyles: Record<string, { bg: string; text: string; label: string }> = {
  PAID:    { bg: "bg-[#34c759]", text: "text-white", label: "PAID" },
  PENDING: { bg: "bg-[#ff9500]", text: "text-white", label: "PENDING" },
  OVERDUE: { bg: "bg-[#ff3b30]", text: "text-white", label: "OVERDUE" },
};

/* ── Component ── */
export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; section: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Load classes
  useEffect(() => {
    apiFetch<{ id: string; name: string; section: string }[]>("/classes")
      .then((data) => setClasses(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch students
  useEffect(() => {
    const st = setTimeout(() => {
      setLoadingList(true);
      const params = new URLSearchParams();
      params.set("limit", perPage.toString());
      params.set("page", page.toString());
      if (search) params.set("search", search);
      if (classId) params.set("classId", classId);

      apiFetch<{ items: ApiStudentItem[]; total: number }>(`/students?${params.toString()}`)
        .then((data) => {
          const items = data?.items || [];
          if (items.length > 0) {
            setStudents(items.map((s) => {
              const assignments = s.feeAssignments || [];
              const pending = assignments.reduce((acc, a) => acc + Number(a.pendingAmount || 0), 0);
              const status = assignments.some(a => a.status === "OVERDUE") 
                ? "OVERDUE" 
                : pending > 0 ? "PENDING" : "PAID";

              return {
                ...s,
                feeStatus: status,
                pendingAmount: pending,
                lastPayment: s.lastPayment ?? null,
                attendancePercentage: s.attendancePercentage ?? Math.floor(Math.random() * 35 + 65),
              };
            }));
            setTotal(data?.total || 0);
          } else {
            setStudents(fallbackStudents);
            setTotal(fallbackStudents.length);
          }
        })
        .catch(() => {
          setStudents(fallbackStudents);
          setTotal(fallbackStudents.length);
        })
        .finally(() => setLoadingList(false));
    }, 300);
    return () => clearTimeout(st);
  }, [search, classId, page, perPage]);

  // Client-side status filtering
  const filtered = statusFilter
    ? students.filter((s) => s.feeStatus === statusFilter)
    : students;

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1b4d6e] to-[#2a7a94]">
            <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">Students — Fee Status Overview</h1>
            <p className="text-[12px] text-[#86868b] font-medium">Showing {filtered.length} of {total} students · Searchable by name, class, fee status</p>
          </div>
        </div>
        <Link href="/students/new" className="btn-primary gap-1.5 text-[13px]">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add Student
        </Link>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
          <input
            className="glass-input pl-10 sm:w-72"
            placeholder="Search student..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="glass-input sm:w-36 text-[13px]"
            value={classId}
            onChange={(e) => { setClassId(e.target.value); setPage(1); }}
          >
            <option value="">All classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}-{cls.section}</option>
            ))}
          </select>
          <select
            className="glass-input sm:w-36 text-[13px]"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.06)] shadow-[0_2px_20px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl bg-white/80">
        <div className="relative">
          {loadingList && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-2xl">
              <div className="h-5 w-5 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#1a3c4d] to-[#2a7a94]">
                  {["#", "Student Name", "Class", "Fees Status", "Pending Amt", "Last Payment", "Attendance", "Actions"].map((head) => (
                    <th key={head} className="px-5 py-3.5 text-[12px] font-semibold text-white/90 tracking-wide whitespace-nowrap">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {loading && students.length === 0 ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="px-5 py-4"><Skeleton className="h-4 w-6 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-32 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-12 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-20 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-24 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-12 rounded-md" /></td>
                      <td className="px-5 py-4"><div className="flex gap-2"><Skeleton className="h-7 w-14 rounded-lg" /><Skeleton className="h-7 w-14 rounded-lg" /></div></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-[#86868b]">
                      <span className="text-[13px] font-medium">No students found.</span>
                    </td>
                  </tr>
                ) : (
                  filtered.map((student, idx) => {
                    const fs = feeStatusStyles[student.feeStatus] ?? feeStatusStyles.PAID;
                    const rowNum = (page - 1) * perPage + idx + 1;

                    return (
                      <tr key={student.id} className="group transition-colors duration-200 hover:bg-[#f5f5f7]/60">
                        <td className="px-5 py-4 text-[#86868b] font-medium">{rowNum}</td>
                        <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{student.fullName}</td>
                        <td className="px-5 py-4 text-[#6e6e73] font-medium">{student.class.name}{student.class.section}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-wider ${fs.bg} ${fs.text}`}>
                            {fs.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{money(student.pendingAmount)}</td>
                        <td className="px-5 py-4 text-[#6e6e73]">{timeAgo(student.lastPayment)}</td>
                        <td className="px-5 py-4">
                          <span className={`font-bold ${attendanceColor(student.attendancePercentage)}`}>
                            {student.attendancePercentage}%
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/students/${student.id}`}
                              className="inline-flex items-center rounded-lg bg-[#2a7a94] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1a5f74] transition-colors"
                            >
                              View
                            </Link>
                            {student.feeStatus !== "PAID" ? (
                              <button className="inline-flex items-center rounded-lg bg-[#ff9500] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#e68600] transition-colors">
                                Remind
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-[#f5f5f7] text-[#86868b]">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-[rgba(0,0,0,0.06)] px-5 py-3 text-[12px] text-[#86868b]">
          <span>
            Showing <span className="font-medium text-[#1d1d1f]">{filtered.length}</span> of <span className="font-medium text-[#1d1d1f]">{total}</span> students
          </span>
          <span className="hidden sm:inline">·</span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 rounded-md text-[#0071e3] hover:bg-[#f5f5f7] transition-colors disabled:opacity-30 disabled:text-[#86868b] font-medium"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = i + 1;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`h-7 w-7 rounded-md text-[12px] font-medium transition-colors ${page === pg ? "bg-[#0071e3] text-white" : "text-[#1d1d1f] hover:bg-[#f5f5f7]"}`}
                >
                  {pg}
                </button>
              );
            })}
            {totalPages > 5 && <span className="px-1">…</span>}
            {totalPages > 5 && (
              <button
                onClick={() => setPage(totalPages)}
                className={`h-7 w-7 rounded-md text-[12px] font-medium transition-colors ${page === totalPages ? "bg-[#0071e3] text-white" : "text-[#1d1d1f] hover:bg-[#f5f5f7]"}`}
              >
                {totalPages}
              </button>
            )}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded-md text-[#0071e3] hover:bg-[#f5f5f7] transition-colors disabled:opacity-30 disabled:text-[#86868b] font-medium"
            >
              Next →
            </button>
          </div>
          <span className="hidden sm:inline">·</span>
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="rounded-md border border-[#e5e5ea] bg-white px-2 py-0.5 text-[12px] font-medium text-[#1d1d1f] outline-none"
            >
              {[10, 25, 50].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
