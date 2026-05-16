"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch, communicationApi } from "@/lib/api";
import { formatDateShort, formatINR } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

/* ── Types ── */
type StudentRow = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  parentPhone?: string;
  isActive: boolean;
  /* enriched fields — filled from API or fallback */
  feeStatus: "PAID" | "PENDING" | "OVERDUE" | null;
  pendingAmount: number | null;
  lastPayment: string | null;
  attendancePercentage: number | null;
};

type ApiStudentItem = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  parentPhone?: string;
  isActive: boolean;
  feeAssignments?: { pendingAmount: string | number; status: string }[];
  feeStatus?: "PAID" | "PENDING" | "OVERDUE";
  pendingAmount?: number;
  lastPayment?: string | null;
  attendancePercentage?: number;
};

type SortKey = "name" | "class" | "feeStatus" | "pendingAmount" | "lastPayment" | "attendance";
type SortDirection = "asc" | "desc";

/* ── Fallback seed data (shown when API has no students) ── */
const fallbackStudents: StudentRow[] = [
  { id: "1", admissionNumber: "ADM001", fullName: "Rohit Sharma", class: { name: "9", section: "A" }, parentPhone: "+919876543210", isActive: true, feeStatus: "OVERDUE", pendingAmount: 36000, lastPayment: null, attendancePercentage: 66 },
  { id: "2", admissionNumber: "ADM002", fullName: "Priya Kulkarni", class: { name: "7", section: "B" }, parentPhone: "+919812345670", isActive: true, feeStatus: "OVERDUE", pendingAmount: 24000, lastPayment: null, attendancePercentage: 90 },
  { id: "3", admissionNumber: "ADM003", fullName: "Arjun Mehta", class: { name: "6", section: "C" }, parentPhone: "+919845612307", isActive: true, feeStatus: "PENDING", pendingAmount: 18500, lastPayment: null, attendancePercentage: 78 },
  { id: "4", admissionNumber: "ADM004", fullName: "Aarav Shah", class: { name: "8", section: "A" }, parentPhone: "+919845670123", isActive: true, feeStatus: "PAID", pendingAmount: 0, lastPayment: "2025-04-14", attendancePercentage: 95 },
  { id: "5", admissionNumber: "ADM005", fullName: "Sneha Joshi", class: { name: "10", section: "B" }, parentPhone: "+919822334455", isActive: true, feeStatus: "PENDING", pendingAmount: 12000, lastPayment: null, attendancePercentage: 88 },
  { id: "6", admissionNumber: "ADM006", fullName: "Veer Rao", class: { name: "8", section: "A" }, parentPhone: "+919833445566", isActive: true, feeStatus: "PAID", pendingAmount: 0, lastPayment: "2025-04-10", attendancePercentage: 92 },
  { id: "7", admissionNumber: "ADM007", fullName: "Pooja Verma", class: { name: "6", section: "C" }, parentPhone: "+919811223344", isActive: true, feeStatus: "PAID", pendingAmount: 0, lastPayment: "2025-04-12", attendancePercentage: 72 },
];

/* ── Helpers ── */
function timeAgo(date: string | null): string {
  if (!date) return "-";
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

function feeStatusTone(status: StudentRow["feeStatus"]) {
  if (status === "PAID") return "good";
  if (status === "PENDING") return "warn";
  if (status === "OVERDUE") return "danger";
  return "neutral";
}

function pendingAmountClass(amount: number | null) {
  if (amount === null) return "text-[#86868b]";
  if (amount === 0) return "text-[#0F8A4A]";
  return "text-[#C8242C]";
}

function roleCanViewFees(role?: string) {
  return role === "ADMIN" || role === "PRINCIPAL" || role === "ACCOUNTANT";
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function sortValue(student: StudentRow, key: SortKey) {
  if (key === "name") return student.fullName;
  if (key === "class") return `${student.class.name}${student.class.section}`;
  if (key === "feeStatus") return student.feeStatus ?? "";
  if (key === "pendingAmount") return student.pendingAmount ?? Number.POSITIVE_INFINITY;
  if (key === "lastPayment") return student.lastPayment ? new Date(student.lastPayment).getTime() : 0;
  return student.attendancePercentage ?? -1;
}

function compareStudents(left: StudentRow, right: StudentRow, key: SortKey, direction: SortDirection) {
  const leftValue = sortValue(left, key);
  const rightValue = sortValue(right, key);
  const multiplier = direction === "asc" ? 1 : -1;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return (leftValue - rightValue) * multiplier || left.fullName.localeCompare(right.fullName, "en-IN");
  }

  return String(leftValue).localeCompare(String(rightValue), "en-IN", { numeric: true, sensitivity: "base" }) * multiplier;
}

/* ── Component ── */
export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; section: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canViewFees, setCanViewFees] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: 'activate' | 'deactivate'; studentId: string | null; error?: string }>({ isOpen: false, action: 'deactivate', studentId: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDialog, setBulkDialog] = useState<{
    isOpen: boolean;
    action: "whatsapp" | "promote" | "inactive" | null;
    message: string;
    targetClassId: string;
    error?: string;
    busy?: boolean;
  }>({ isOpen: false, action: null, message: "", targetClassId: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "name", direction: "asc" });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setIsAdmin(u.role === "ADMIN" || u.role === "PRINCIPAL");
        setCanViewFees(roleCanViewFees(u.role));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Filters
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [showInactive, setShowInactive] = useState(false);

  // Load classes
  useEffect(() => {
    cachedFetch("classes:list", () => apiFetch<{ id: string; name: string; section: string }[]>("/classes"))
      .then((data) => setClasses(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch students
  useEffect(() => {
    setLoadingList(true);
    const params = new URLSearchParams();
    params.set("limit", perPage.toString());
    params.set("page", page.toString());
    if (search) params.set("search", search);
    if (classId) params.set("classId", classId);
    if (showInactive) params.set("showInactive", "true");

    const cacheKey = `students:list:${params.toString()}`;
    cachedFetch(cacheKey, () => apiFetch<{ items: ApiStudentItem[]; total: number }>(`/students?${params.toString()}`))
      .then((data) => {
        const items = data?.items || [];
        if (items.length > 0) {
          setStudents(items.map((s) => {
            const hasFeeData = Array.isArray(s.feeAssignments);
            const assignments = s.feeAssignments ?? [];
            const pending = hasFeeData ? assignments.reduce((acc, a) => acc + Number(a.pendingAmount || 0), 0) : null;
            const status = !hasFeeData
              ? null
              : assignments.some(a => a.status === "OVERDUE")
                ? "OVERDUE"
                : (pending ?? 0) > 0 ? "PENDING" : "PAID";

            return {
              ...s,
              feeStatus: status,
              pendingAmount: pending,
              lastPayment: s.lastPayment ?? null,
              attendancePercentage: s.attendancePercentage ?? null,
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
  }, [search, classId, page, perPage, showInactive]);

  // Client-side status filtering
  const filtered = statusFilter && canViewFees
    ? students.filter((s) => s.feeStatus === statusFilter)
    : students;
  const sortedFiltered = useMemo(
    () => [...filtered].sort((left, right) => compareStudents(left, right, sort.key, sort.direction)),
    [filtered, sort.direction, sort.key]
  );

  const totalPages = Math.ceil(total / perPage);
  const tableHeaders: { label: string; sortKey?: SortKey }[] = canViewFees
    ? [
        { label: "" },
        { label: "#" },
        { label: "Student Name", sortKey: "name" },
        { label: "Class", sortKey: "class" },
        { label: "Fees Status", sortKey: "feeStatus" },
        { label: "Pending Amt", sortKey: "pendingAmount" },
        { label: "Last Payment", sortKey: "lastPayment" },
        { label: "Attendance", sortKey: "attendance" },
        { label: "Actions" }
      ]
    : [
        { label: "" },
        { label: "#" },
        { label: "Student Name", sortKey: "name" },
        { label: "Class", sortKey: "class" },
        { label: "Attendance", sortKey: "attendance" },
        { label: "Actions" }
      ];
  const selectedStudents = selectedIds
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is StudentRow => Boolean(student));
  const visibleIds = sortedFiltered.map((student) => student.id);
  const visibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedCount = selectedStudents.length;

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, action: 'deactivate', studentId: id });
  };

  const handleActivate = (id: string) => {
    setConfirmDialog({ isOpen: true, action: 'activate', studentId: id });
  };

  const handleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const handleConfirmAction = async () => {
    const { studentId, action } = confirmDialog;
    if (!studentId) return;

    try {
      if (action === 'deactivate') {
        await apiFetch(`/students/${studentId}`, { method: "DELETE" });
      } else {
        await apiFetch(`/students/${studentId}/activate`, { method: "PATCH" });
      }
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setTotal((prev) => prev - 1);
      setConfirmDialog({ isOpen: false, action: 'deactivate', studentId: null });
    } catch (e: any) {
      setConfirmDialog((prev) => ({ ...prev, error: e?.message || `Failed to ${action} student` }));
    }
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((prev) => {
      if (visibleSelected) return prev.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const exportSelectedCsv = () => {
    const rows = [
      ["Admission No", "Student Name", "Class", "Parent Phone", "Fee Status", "Pending Amount", "Attendance"],
      ...selectedStudents.map((student) => [
        student.admissionNumber,
        student.fullName,
        `${student.class.name}-${student.class.section}`,
        student.parentPhone ?? "",
        student.feeStatus ? student.feeStatus.toLowerCase() : "",
        student.pendingAmount ?? "",
        student.attendancePercentage === null ? "" : `${student.attendancePercentage}%`
      ])
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice(`Exported ${selectedCount} selected students.`);
  };

  const openBulkDialog = (action: "whatsapp" | "promote" | "inactive") => {
    setBulkDialog({
      isOpen: true,
      action,
      message: action === "whatsapp" ? "Dear parent, this is an update from SmartShala." : "",
      targetClassId: "",
    });
  };

  const closeBulkDialog = () => {
    if (bulkDialog.busy) return;
    setBulkDialog({ isOpen: false, action: null, message: "", targetClassId: "" });
  };

  const handleBulkConfirm = async () => {
    if (!bulkDialog.action || selectedCount === 0) return;
    setBulkDialog((prev) => ({ ...prev, busy: true, error: undefined }));
    try {
      if (bulkDialog.action === "whatsapp") {
        const message = bulkDialog.message.trim();
        if (message.length < 3) throw new Error("Message must be at least 3 characters.");
        await Promise.all(selectedStudents.map((student) =>
          communicationApi.sendMessage({
            targetType: "STUDENT",
            studentId: student.id,
            type: "CUSTOM",
            message
          })
        ));
        setNotice(`Queued WhatsApp message for ${selectedCount} parents.`);
      }

      if (bulkDialog.action === "promote") {
        const targetClass = classes.find((cls) => cls.id === bulkDialog.targetClassId);
        if (!targetClass) throw new Error("Select target class.");
        await Promise.all(selectedStudents.map((student) =>
          apiFetch(`/students/${student.id}`, {
            method: "PATCH",
            body: JSON.stringify({ classId: targetClass.id })
          })
        ));
        setStudents((prev) => prev.map((student) =>
          selectedIds.includes(student.id)
            ? { ...student, class: { name: targetClass.name, section: targetClass.section } }
            : student
        ));
        setNotice(`Promoted ${selectedCount} students to ${targetClass.name}-${targetClass.section}.`);
      }

      if (bulkDialog.action === "inactive") {
        await Promise.all(selectedStudents.map((student) => apiFetch(`/students/${student.id}`, { method: "DELETE" })));
        setStudents((prev) => prev.filter((student) => !selectedIds.includes(student.id)));
        setTotal((prev) => Math.max(0, prev - selectedCount));
        setNotice(`Marked ${selectedCount} students inactive.`);
      }

      setSelectedIds([]);
      closeBulkDialog();
    } catch (e: any) {
      setBulkDialog((prev) => ({ ...prev, busy: false, error: e?.message || "Bulk action failed" }));
    }
  };

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
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">Students</h1>
          </div>
        </div>
        {isAdmin && (
          <Link href="/students/new" className="btn-primary gap-1.5 text-[13px]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add Student
          </Link>
        )}
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
          {canViewFees ? (
            <select
              className="glass-input sm:w-36 text-[13px]"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All fee statuses</option>
              <option value="PAID">Paid fees</option>
              <option value="PENDING">Pending fees</option>
              <option value="OVERDUE">Overdue fees</option>
            </select>
          ) : null}
          <button
            onClick={() => { setShowInactive(!showInactive); setPage(1); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[13px] font-medium ${
              showInactive 
                ? "bg-[#0071e3] border-[#0071e3] text-white shadow-[0_2px_10px_rgba(0,113,227,0.3)]" 
                : "bg-white border-[rgba(0,0,0,0.08)] text-[#1d1d1f] hover:bg-[#f5f5f7]"
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${showInactive ? "bg-white animate-pulse" : "bg-[#86868b]"}`} />
            {showInactive ? "Showing Inactive" : "Show Inactive Only"}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="flex items-center justify-between rounded-xl border border-[#E2F0FB] bg-[#E2F0FB] px-4 py-3 text-[13px] font-semibold text-[#1F6FB8]">
          <span>{notice}</span>
          <button className="text-[#1F6FB8] underline-offset-2 hover:underline" onClick={() => setNotice(null)} type="button">Dismiss</button>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[#DCE1E8] bg-white px-4 py-3 shadow-[0_8px_22px_-16px_rgba(15,20,25,0.35)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#0F1419]">{selectedCount} selected</p>
            <p className="text-[12px] font-medium text-[#5A6573]">Bulk actions apply to visible selected student rows.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => openBulkDialog("whatsapp")} type="button">Send WhatsApp</button>
            {isAdmin ? <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => openBulkDialog("promote")} type="button">Promote class</button> : null}
            <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={exportSelectedCsv} type="button">Export CSV</button>
            {isAdmin ? <button className="rounded-lg bg-[#C8242C] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#a51d24]" onClick={() => openBulkDialog("inactive")} type="button">Mark inactive</button> : null}
            <button className="rounded-lg px-3 py-2 text-[12px] font-semibold text-[#5A6573] hover:bg-[#F7F8FB]" onClick={() => setSelectedIds([])} type="button">Clear</button>
          </div>
        </div>
      ) : null}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.06)] shadow-[0_2px_20px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl bg-white/80">
        <div className="relative">
          {loadingList && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-2xl">
              <div className="h-5 w-5 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-[13px] ${canViewFees ? "min-w-[900px]" : "min-w-[640px]"}`}>
              <thead>
                <tr className="bg-gradient-to-r from-[#1a3c4d] to-[#2a7a94]">
                  {tableHeaders.map((head, index) => (
                    <th
                      aria-sort={head.sortKey ? (sort.key === head.sortKey ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined}
                      key={`${head.label}-${index}`}
                      className="px-5 py-3.5 text-[12px] font-semibold text-white/90 tracking-wide whitespace-nowrap"
                    >
                      {index === 0 ? (
                        <input
                          aria-label="Select all visible students"
                          checked={visibleSelected}
                          className="h-4 w-4 rounded border-white/60"
                          onChange={toggleVisibleSelection}
                          type="checkbox"
                        />
                      ) : head.sortKey ? (
                        <button
                          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-white/10"
                          onClick={() => handleSort(head.sortKey!)}
                          type="button"
                        >
                          {head.label}
                          <span aria-hidden="true" className="text-[10px]">
                            {sort.key === head.sortKey ? (sort.direction === "asc" ? "Asc" : "Desc") : "Sort"}
                          </span>
                        </button>
                      ) : head.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {loading && students.length === 0 ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="px-5 py-4"><Skeleton className="h-4 w-6 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-6 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-32 rounded-md" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-12 rounded-md" /></td>
                      {canViewFees ? (
                        <>
                          <td className="px-5 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                          <td className="px-5 py-4"><Skeleton className="h-4 w-20 rounded-md" /></td>
                          <td className="px-5 py-4"><Skeleton className="h-4 w-24 rounded-md" /></td>
                        </>
                      ) : null}
                      <td className="px-5 py-4"><Skeleton className="h-4 w-12 rounded-md" /></td>
                      <td className="px-5 py-4"><div className="flex gap-2"><Skeleton className="h-7 w-14 rounded-lg" /><Skeleton className="h-7 w-14 rounded-lg" /></div></td>
                    </tr>
                  ))
                ) : sortedFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={tableHeaders.length} className="px-5 py-16 text-center text-[#86868b]">
                      <span className="text-[13px] font-medium">No students found.</span>
                    </td>
                  </tr>
                ) : (
                  sortedFiltered.map((student, idx) => {
                    const rowNum = (page - 1) * perPage + idx + 1;
                    const menuOpen = openActionMenu === student.id;

                    return (
                      <tr key={student.id} className="group transition-colors duration-200 hover:bg-[#f5f5f7]/60">
                        <td className="px-5 py-4">
                          <input
                            aria-label={`Select ${student.fullName}`}
                            checked={selectedIds.includes(student.id)}
                            className="h-4 w-4 rounded border-[#C2C9D4]"
                            onChange={() => toggleStudentSelection(student.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-5 py-4 text-[#86868b] font-medium">{rowNum}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <InitialsAvatar name={student.fullName} size="sm" />
                            <div>
                              <Link className="font-semibold text-[#1d1d1f] transition-colors hover:text-[#2456E6]" href={`/students/${student.id}`}>
                                {student.fullName}
                              </Link>
                              <p className="mt-0.5 font-mono text-[11px] font-medium text-[#86868b]">{student.admissionNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#6e6e73] font-medium">{student.class.name}{student.class.section}</td>
                        {canViewFees ? (
                          <>
                            <td className="px-5 py-4">
                              {student.feeStatus ? (
                                <StatusPill label={student.feeStatus} tone={feeStatusTone(student.feeStatus)} />
                              ) : (
                                <span className="text-[#86868b]">Not available</span>
                              )}
                            </td>
                            <td className={`px-5 py-4 font-semibold ${pendingAmountClass(student.pendingAmount)}`}>
                              {student.pendingAmount === null ? "-" : formatINR(student.pendingAmount)}
                            </td>
                            <td className="px-5 py-4 text-[#6e6e73]">
                              <span>{student.lastPayment ? formatDateShort(student.lastPayment) : "-"}</span>
                              {student.lastPayment ? <span className="ml-1 text-[11px] text-[#86868b]">({timeAgo(student.lastPayment)})</span> : null}
                            </td>
                          </>
                        ) : null}
                        <td className="px-5 py-4">
                          {student.attendancePercentage === null ? (
                            <span className="text-[#86868b]">-</span>
                          ) : (
                            <span className={`font-bold ${attendanceColor(student.attendancePercentage)}`}>
                              {student.attendancePercentage}%
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/students/${student.id}`}
                              className="inline-flex items-center rounded-lg bg-[#2a7a94] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1a5f74] transition-colors"
                            >
                              View
                            </Link>
                            {isAdmin ? (
                              <Link
                                href={`/students/${student.id}/edit`}
                                className="inline-flex items-center rounded-lg bg-[#0071e3]/10 px-3 py-1.5 text-[11px] font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white"
                              >
                                Edit
                              </Link>
                            ) : null}
                            {(isAdmin || (canViewFees && student.feeStatus && student.feeStatus !== "PAID")) ? (
                              <div className="relative">
                                <button
                                  aria-expanded={menuOpen}
                                  aria-label={`More actions for ${student.fullName}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE1E8] bg-white text-[#5A6573] transition-colors hover:bg-[#F7F8FB]"
                                  onClick={() => setOpenActionMenu(menuOpen ? null : student.id)}
                                  type="button"
                                >
                                  <span className="text-[16px] leading-none">...</span>
                                </button>
                                {menuOpen ? (
                                  <div className="absolute right-0 top-8 z-20 min-w-[150px] overflow-hidden rounded-xl border border-[#DCE1E8] bg-white py-1 shadow-[0_12px_32px_-12px_rgba(15,20,25,0.35)]">
                                    {canViewFees && student.feeStatus && student.feeStatus !== "PAID" ? (
                                      <button
                                        className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
                                        onClick={() => setOpenActionMenu(null)}
                                        type="button"
                                      >
                                        Send reminder
                                      </button>
                                    ) : null}
                                    {isAdmin ? (
                                      student.isActive ? (
                                        <button
                                          className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5]"
                                          onClick={() => {
                                            setOpenActionMenu(null);
                                            handleDelete(student.id);
                                          }}
                                          type="button"
                                        >
                                          Deactivate
                                        </button>
                                      ) : (
                                        <button
                                          className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#0F8A4A] hover:bg-[#E1F5EA]"
                                          onClick={() => {
                                            setOpenActionMenu(null);
                                            handleActivate(student.id);
                                          }}
                                          type="button"
                                        >
                                          Activate
                                        </button>
                                      )
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
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
            Showing <span className="font-medium text-[#1d1d1f]">{sortedFiltered.length}</span> of <span className="font-medium text-[#1d1d1f]">{total}</span> students
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
      {/* ── Custom Confirm Modal ── */}
      {confirmDialog.isOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${confirmDialog.action === 'deactivate' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[#34c759]/10 text-[#34c759]'} mb-4`}>
                {confirmDialog.action === 'deactivate' ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                )}
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f]">
                {confirmDialog.action === 'deactivate' ? 'Deactivate Student' : 'Activate Student'}
              </h3>
              <p className="mt-2 text-[13px] text-[#86868b]">
                Are you sure you want to {confirmDialog.action} this student? You can reverse this action later.
              </p>

              {confirmDialog.error && (
                <div className="mt-4 p-3 rounded-lg bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.2)] text-[#d70015] text-[12px] font-medium text-left flex items-start gap-2">
                  <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {confirmDialog.error}
                </div>
              )}
            </div>
            <div className="flex border-t border-[rgba(0,0,0,0.06)] bg-[#f5f5f7]/50">
              <button 
                onClick={() => setConfirmDialog({ isOpen: false, action: 'deactivate', studentId: null })} 
                className="flex-1 py-3 text-[14px] font-medium text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors border-r border-[rgba(0,0,0,0.06)]"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAction} 
                className={`flex-1 py-3 text-[14px] font-semibold transition-colors ${confirmDialog.action === 'deactivate' ? 'text-[#ff3b30] hover:bg-[#ff3b30]/10' : 'text-[#34c759] hover:bg-[#34c759]/10'}`}
              >
                {confirmDialog.action === 'deactivate' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {bulkDialog.isOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-[#DCE1E8] px-6 py-4">
              <h3 className="text-[18px] font-semibold text-[#0F1419]">
                {bulkDialog.action === "whatsapp" ? "Send WhatsApp" : bulkDialog.action === "promote" ? "Promote class" : "Mark inactive"}
              </h3>
              <p className="mt-1 text-[13px] font-medium text-[#5A6573]">{selectedCount} selected students</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              {bulkDialog.action === "whatsapp" ? (
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6573]">Message</span>
                  <textarea
                    className="mt-2 min-h-[120px] w-full rounded-xl border border-[#DCE1E8] px-3 py-2 text-[14px] leading-6 outline-none focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10"
                    onChange={(e) => setBulkDialog((prev) => ({ ...prev, message: e.target.value }))}
                    value={bulkDialog.message}
                  />
                </label>
              ) : null}

              {bulkDialog.action === "promote" ? (
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6573]">Target class</span>
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-[#DCE1E8] bg-white px-3 text-[14px] outline-none focus:border-[#2456E6] focus:ring-4 focus:ring-[#2456E6]/10"
                    onChange={(e) => setBulkDialog((prev) => ({ ...prev, targetClassId: e.target.value }))}
                    value={bulkDialog.targetClassId}
                  >
                    <option value="">Select class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}-{cls.section}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {bulkDialog.action === "inactive" ? (
                <div className="rounded-xl border border-[#FCE3E5] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">
                  This marks selected students inactive. Existing records stay available.
                </div>
              ) : null}

              {bulkDialog.error ? (
                <div className="rounded-xl border border-[#FCE3E5] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">
                  {bulkDialog.error}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#DCE1E8] bg-[#F7F8FB] px-6 py-4">
              <button className="rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" disabled={bulkDialog.busy} onClick={closeBulkDialog} type="button">Cancel</button>
              <button
                className="rounded-lg bg-[#2456E6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1B45BD] disabled:bg-[#C2C9D4] disabled:text-[#7A8390]"
                disabled={bulkDialog.busy}
                onClick={handleBulkConfirm}
                type="button"
              >
                {bulkDialog.busy ? "Working..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
