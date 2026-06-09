"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { MarqueeText } from "@/components/ui/KpiCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch, communicationApi, studentsApi } from "@/lib/api";
import { formatDateShort, formatINR } from "@/lib/formatters";
import { cachedFetch, invalidateCachePrefix } from "@/lib/prefetchCache";
import { CreateStudentModal } from "./new/CreateStudentModal";
import Link from "next/link";

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
  currentOutstanding: number | null;
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
  currentOutstanding?: number;
  lastPayment?: string | null;
  attendancePercentage?: number;
};

type SortKey = "name" | "class" | "feeStatus" | "pendingAmount" | "currentOutstanding" | "lastPayment" | "attendance";
type SortDirection = "asc" | "desc";

// Columns mirror the Register New Student modal fields (Personal → Academic & Fee → Guardian).
// parentName/parentPhone are derived from the guardians like the modal does, so they are not columns.
const studentImportTemplateHeaders = [
  "fullName",
  "rollNumber",
  "gender",
  "dateOfBirth",
  "aadhaar",
  "apaar",
  "className",
  "classSection",
  "feeStructure",
  "transportRequired",
  "transportFeeAmount",
  "previousSchool",
  "siblingDiscount",
  "fatherName",
  "fatherPhone",
  "fatherOccupation",
  "motherName",
  "motherPhone",
  "motherOccupation",
  "guardianName",
  "guardianPhone",
  "guardianOccupation",
  "address"
];

type ImportStudentRow = {
  rowNumber: number;
  fullName: string;
  className: string;
  classSection: string;
  parentName: string;
  parentPhone: string;
  alternatePhone?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  rollNumber?: number;
  dateOfBirth?: string;
  aadhaar?: string;
  apaar?: string;
  feeStructure?: string;
  transportRequired?: boolean;
  transportFeeAmount?: number;
  previousSchool?: string;
  siblingDiscount?: boolean;
  address?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherPhone?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianOccupation?: string;
};

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

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function csvValue(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value) return value.trim();
  }
  return "";
}

function csvBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return ["true", "yes", "y", "1"].includes(normalized);
}

function dateDisplayToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) throw new Error("Date of birth must be yyyy-mm-dd or dd/mm/yyyy.");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseStudentsCsv(text: string): ImportStudentRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one student.");

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows: ImportStudentRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index]);
    const raw: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      raw[header] = cells[cellIndex] ?? "";
    });

    const fullName = csvValue(raw, ["fullName", "studentName", "name"]);
    const genderRaw = csvValue(raw, ["gender"]).toUpperCase();
    const rollRaw = csvValue(raw, ["rollNumber", "roll"]);
    const dobRaw = csvValue(raw, ["dateOfBirth", "dob"]);

    const fatherName = csvValue(raw, ["fatherName"]);
    const fatherPhone = csvValue(raw, ["fatherPhone"]);
    const motherName = csvValue(raw, ["motherName"]);
    const motherPhone = csvValue(raw, ["motherPhone"]);
    const guardianName = csvValue(raw, ["guardianName"]);
    const guardianPhone = csvValue(raw, ["guardianPhone"]);

    // Derive the primary parent like the create modal: first guardian with both name + phone.
    const primaryGuardian = [
      { name: fatherName, phone: fatherPhone },
      { name: motherName, phone: motherPhone },
      { name: guardianName, phone: guardianPhone }
    ].find((guardian) => guardian.name && guardian.phone);
    const parentName = csvValue(raw, ["parentName"]) || primaryGuardian?.name || "";
    const parentPhone = csvValue(raw, ["parentPhone", "phone"]) || primaryGuardian?.phone || "";
    const alternatePhone =
      csvValue(raw, ["alternatePhone"]) || [motherPhone, fatherPhone, guardianPhone].find((phone) => phone && phone !== parentPhone) || "";

    if (!fullName) throw new Error(`Row ${index + 1}: fullName is required.`);
    if (!parentName || !parentPhone) throw new Error(`Row ${index + 1}: add at least one guardian with both name and phone.`);

    const transportFeeRaw = csvValue(raw, ["transportFeeAmount"]);
    const transportFeeAmount = transportFeeRaw && !Number.isNaN(Number(transportFeeRaw)) ? Number(transportFeeRaw) : undefined;

    rows.push({
      rowNumber: index + 1,
      fullName,
      className: csvValue(raw, ["className", "class"]),
      classSection: csvValue(raw, ["classSection", "section"]),
      parentName,
      parentPhone,
      alternatePhone: alternatePhone || undefined,
      gender: ["MALE", "FEMALE", "OTHER"].includes(genderRaw) ? (genderRaw as ImportStudentRow["gender"]) : undefined,
      rollNumber: rollRaw ? Number(rollRaw) : undefined,
      dateOfBirth: dobRaw ? dateDisplayToIso(dobRaw) : undefined,
      aadhaar: csvValue(raw, ["aadhaar"]) || undefined,
      apaar: csvValue(raw, ["apaar"]) || undefined,
      feeStructure: csvValue(raw, ["feeStructure", "feeStructureName"]) || undefined,
      transportRequired: csvBoolean(csvValue(raw, ["transportRequired"])),
      transportFeeAmount,
      previousSchool: csvValue(raw, ["previousSchool"]) || undefined,
      siblingDiscount: csvBoolean(csvValue(raw, ["siblingDiscount"])),
      address: csvValue(raw, ["address"]) || undefined,
      fatherName: fatherName || undefined,
      fatherPhone: fatherPhone || undefined,
      fatherOccupation: csvValue(raw, ["fatherOccupation"]) || undefined,
      motherName: motherName || undefined,
      motherPhone: motherPhone || undefined,
      motherOccupation: csvValue(raw, ["motherOccupation"]) || undefined,
      guardianName: guardianName || undefined,
      guardianPhone: guardianPhone || undefined,
      guardianOccupation: csvValue(raw, ["guardianOccupation"]) || undefined
    });
  }

  return rows;
}

function classKey(name: string, section: string) {
  return `${name.trim().toLowerCase()}::${section.trim().toLowerCase()}`;
}

function pendingAmountClass(amount: number | null) {
  if (amount === null) return "text-[#86868b]";
  if (amount === 0) return "text-[#0F8A4A]";
  return "text-[#C8242C]";
}

function sortDirectionLabel(direction: SortDirection) {
  return direction === "asc" ? "A-Z" : "Z-A";
}

function roleCanViewFees(role?: string) {
  return role === "ADMIN" || role === "PRINCIPAL" || role === "ACCOUNTANT";
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function pdfEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfMoney(value: number) {
  return `Rs ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrapPdfText(value: string | number | null | undefined, width: number, fontSize = 8) {
  const text = String(value ?? "-").trim() || "-";
  const maxChars = Math.max(6, Math.floor(width / (fontSize * 0.48)));
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/)) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function buildStudentsPdf(students: StudentRow[]) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const rowLineHeight = 10;
  const columns = [
    { label: "Admission No", width: 68 },
    { label: "Student Name", width: 118 },
    { label: "Class", width: 46 },
    { label: "Parent Phone", width: 88 },
    { label: "Fee Status", width: 62 },
    { label: "Pending", width: 76 },
    { label: "Attendance", width: 57 }
  ];
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = margin;

  const emit = (command: string) => commands.push(command);
  const pdfY = (topY: number) => pageHeight - topY;
  const text = (value: string | number | null | undefined, x: number, topY: number, size = 8, font = "F1") => {
    emit(`BT /${font} ${size} Tf 0 0 0 rg ${x.toFixed(2)} ${pdfY(topY).toFixed(2)} Td (${pdfEscape(value)}) Tj ET`);
  };
  const rect = (x: number, topY: number, width: number, height: number, fill: string) => {
    emit(`q ${fill} rg ${x.toFixed(2)} ${(pageHeight - topY - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`);
  };
  const line = (x1: number, topY1: number, x2: number, topY2: number, color = "0.86 0.88 0.91") => {
    emit(`q ${color} RG 0.5 w ${x1.toFixed(2)} ${pdfY(topY1).toFixed(2)} m ${x2.toFixed(2)} ${pdfY(topY2).toFixed(2)} l S Q`);
  };
  const header = () => {
    y = margin;
    text("Students Export", margin, y, 18, "F2");
    text(`Generated ${new Date().toLocaleDateString("en-IN")} | ${students.length} selected`, margin, y + 20, 9);
    y += 44;
    rect(margin, y, tableWidth, 22, "0.95 0.96 0.98");
    let x = margin;
    for (const col of columns) {
      text(col.label, x + 5, y + 14, 7.5, "F2");
      x += col.width;
    }
    y += 22;
  };
  const newPage = () => {
    if (commands.length) pages.push(commands);
    commands = [];
    header();
  };

  header();
  for (const student of students) {
    const row = [
      student.admissionNumber,
      student.fullName,
      `${student.class.name}-${student.class.section}`,
      student.parentPhone ?? "-",
      student.feeStatus ? student.feeStatus.toLowerCase() : "-",
      student.pendingAmount === null ? "-" : pdfMoney(student.pendingAmount),
      student.attendancePercentage === null ? "-" : `${student.attendancePercentage}%`
    ];
    const wrapped = row.map((cell, index) => wrapPdfText(cell, columns[index].width - 10));
    const rowHeight = Math.max(24, Math.max(...wrapped.map((lines) => lines.length)) * rowLineHeight + 10);
    if (y + rowHeight > pageHeight - margin - 24) newPage();

    line(margin, y, margin + tableWidth, y);
    let x = margin;
    wrapped.forEach((lines, columnIndex) => {
      lines.forEach((lineText, lineIndex) => text(lineText, x + 5, y + 14 + lineIndex * rowLineHeight, 7.5));
      x += columns[columnIndex].width;
    });
    y += rowHeight;
  }

  pages.push(commands);
  const totalPages = pages.length;
  pages.forEach((page, index) => {
    page.push(`BT /F1 8 Tf 0.35 0.4 0.45 rg ${margin.toFixed(2)} 24 Td (${pdfEscape(`Page ${index + 1} of ${totalPages}`)}) Tj ET`);
  });

  const objects = ["<< /Type /Catalog /Pages 2 0 R >>"];
  const kids: string[] = [];
  pages.forEach((page, index) => {
    const content = page.join("\n");
    const pageObj = 3 + index * 2;
    const contentObj = pageObj + 1;
    kids.push(`${pageObj} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObj} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects.splice(1, 0, `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`);

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([body], { type: "application/pdf" });
}

function sortValue(student: StudentRow, key: SortKey) {
  if (key === "name") return student.fullName;
  if (key === "class") return `${student.class.name}${student.class.section}`;
  if (key === "feeStatus") return student.feeStatus ?? "";
  if (key === "pendingAmount") return student.pendingAmount ?? Number.POSITIVE_INFINITY;
  if (key === "currentOutstanding") return student.currentOutstanding ?? Number.POSITIVE_INFINITY;
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

  return String(leftValue).localeCompare(String(rightValue), "en-IN", { numeric: true, sensitivity: "base" }) * multiplier
    || left.fullName.localeCompare(right.fullName, "en-IN", { sensitivity: "base" });
}

function toStudentRows(items: ApiStudentItem[]): StudentRow[] {
  return items.map((s) => {
    const hasFeeData = Array.isArray(s.feeAssignments);
    const assignments = s.feeAssignments ?? [];
    const pending = hasFeeData ? assignments.reduce((acc, a) => acc + Number(a.pendingAmount || 0), 0) : null;
    const outstanding = hasFeeData ? Number(s.currentOutstanding ?? 0) : null;
    const status: StudentRow["feeStatus"] = !hasFeeData
      ? null
      : (outstanding ?? 0) > 0 || assignments.some(a => a.status === "OVERDUE")
        ? "OVERDUE"
        : (pending ?? 0) > 0 ? "PENDING" : "PAID";

    return {
      ...s,
      feeStatus: status,
      pendingAmount: pending,
      currentOutstanding: outstanding,
      lastPayment: s.lastPayment ?? null,
      attendancePercentage: s.attendancePercentage ?? null,
    };
  });
}

function resolveStudentList(items: ApiStudentItem[] | undefined, total: unknown, page: number, perPage: number) {
  const rows = toStudentRows(items ?? []);
  const apiTotal = Number(total ?? 0);
  const pageFloorTotal = rows.length > 0 ? (page - 1) * perPage + rows.length : 0;

  return {
    rows,
    total: Math.max(Number.isFinite(apiTotal) ? apiTotal : 0, pageFloorTotal)
  };
}

/* ── Component ── */
export default function StudentsPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; section: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [hasLoadedStudents, setHasLoadedStudents] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [canViewFees, setCanViewFees] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: 'activate' | 'deactivate'; studentId: string | null; error?: string }>({ isOpen: false, action: 'deactivate', studentId: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<string, StudentRow>>({});
  const [bulkDialog, setBulkDialog] = useState<{
    isOpen: boolean;
    action: "whatsapp" | "promote" | "inactive" | null;
    message: string;
    targetClassId: string;
    error?: string;
    busy?: boolean;
  }>({ isOpen: false, action: null, message: "", targetClassId: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "class", direction: "asc" });
  const [importDialog, setImportDialog] = useState<{
    isOpen: boolean;
    fileName: string;
    rows: ImportStudentRow[];
    busy?: boolean;
    error?: string;
  }>({ isOpen: false, fileName: "", rows: [] });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setIsAdmin(u.role === "ADMIN" || u.role === "PRINCIPAL");
        setIsTeacher(u.role === "TEACHER");
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
  const perPage = 15;
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
    if (statusFilter && canViewFees) params.set("feeStatus", statusFilter);

    const cacheKey = `students:list:${params.toString()}`;
    cachedFetch(cacheKey, () => apiFetch<{ items: ApiStudentItem[]; total: number }>(`/students?${params.toString()}`))
      .then((data) => {
        const { rows, total: nextTotal } = resolveStudentList(data?.items, data?.total, page, perPage);
        setStudents(rows);
        setSelectedRows((prev) => {
          const next = { ...prev };
          rows.forEach((row) => {
            if (selectedIds.includes(row.id)) next[row.id] = row;
          });
          return next;
        });
        setTotal(nextTotal);
        setHasLoadedStudents(true);
      })
      .catch(() => {
        setStudents([]);
        setTotal(0);
        setHasLoadedStudents(true);
      })
      .finally(() => setLoadingList(false));
  }, [search, classId, page, perPage, showInactive, statusFilter, canViewFees]);

  useEffect(() => {
    if (!openActionMenu) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-row-action-menu]") || target.closest("[data-row-action-button]")) return;
      setOpenActionMenu(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenActionMenu(null);
    };

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openActionMenu]);

  // Client-side status filtering
  const filtered = statusFilter && canViewFees
    ? students.filter((s) => s.feeStatus === statusFilter)
    : students;
  const sortedFiltered = useMemo(
    () => [...filtered].sort((left, right) => compareStudents(left, right, sort.key, sort.direction)),
    [filtered, sort.direction, sort.key]
  );

  const visibleCount = sortedFiltered.length;
  const visibleFloorTotal = visibleCount > 0 ? (page - 1) * perPage + visibleCount : 0;
  const resolvedTotal = Math.max(total, visibleFloorTotal);
  const displayStart = visibleCount > 0 ? (page - 1) * perPage + 1 : 0;
  const displayEnd = visibleCount > 0 ? (page - 1) * perPage + visibleCount : 0;
  const totalPages = Math.max(1, Math.ceil(resolvedTotal / perPage));
  const tableHeaders: { label: string; sortKey?: SortKey }[] = canViewFees
    ? [
      { label: "" },
      { label: "#" },
      { label: "Student", sortKey: "name" },
      { label: "Class", sortKey: "class" },
      { label: "Fee Status", sortKey: "feeStatus" },
      { label: "Due Now", sortKey: "currentOutstanding" },
      { label: "Balance", sortKey: "pendingAmount" },
      { label: "Last Paid", sortKey: "lastPayment" },
      { label: "Attendance", sortKey: "attendance" },
      { label: "Actions" }
    ]
    : [
      { label: "" },
      { label: "#" },
      { label: "Student", sortKey: "name" },
      { label: "Class", sortKey: "class" },
      { label: "Attendance", sortKey: "attendance" },
      { label: "Actions" }
    ];
  const selectedStudents = selectedIds
    .map((id) => selectedRows[id])
    .filter((student): student is StudentRow => Boolean(student));
  const visibleIds = sortedFiltered.map((student) => student.id);
  const visibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const allFilteredSelected = resolvedTotal > 0 && selectedIds.length >= resolvedTotal;
  const selectedCount = selectedIds.length;
  const isInitialListLoading = loadingList && !hasLoadedStudents;
  const selectAllLabel = "Select All";
  const classOptions = [
    { label: "All Classes", value: "" },
    ...classes.map((cls) => ({ label: `${cls.name}-${cls.section}`, value: cls.id }))
  ];
  const feeStatusOptions = [
    { label: "All Fee Statuses", value: "" },
    { label: "Paid Fees", value: "PAID" },
    { label: "Pending Fees", value: "PENDING" },
    { label: "Overdue Fees", value: "OVERDUE" }
  ];
  const pageNumbers = useMemo(() => {
    const first = Math.max(1, Math.min(page - 1, Math.max(1, totalPages - 3)));
    return Array.from({ length: Math.min(4, totalPages) }, (_, index) => first + index);
  }, [page, totalPages]);

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

  function studentListParams(pageNumber: number, limitNumber: number) {
    const params = new URLSearchParams();
    params.set("limit", limitNumber.toString());
    params.set("page", pageNumber.toString());
    if (search) params.set("search", search);
    if (classId) params.set("classId", classId);
    if (showInactive) params.set("showInactive", "true");
    if (statusFilter && canViewFees) params.set("feeStatus", statusFilter);
    return params;
  }

  async function fetchAllMatchingStudents() {
    const firstParams = studentListParams(1, 100);
    const first = await apiFetch<{ items: ApiStudentItem[]; total: number }>(`/students?${firstParams.toString()}`);
    const pages = Math.ceil((first.total || 0) / 100);
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, pages - 1) }, (_, index) => {
        const params = studentListParams(index + 2, 100);
        return apiFetch<{ items: ApiStudentItem[]; total: number }>(`/students?${params.toString()}`);
      })
    );
    const rows = toStudentRows([...(first.items || []), ...rest.flatMap((page) => page.items || [])]);
    return statusFilter && canViewFees ? rows.filter((row) => row.feeStatus === statusFilter) : rows;
  }

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
      setTotal((prev) => Math.max(0, prev - 1));
      setConfirmDialog({ isOpen: false, action: 'deactivate', studentId: null });
    } catch (e: any) {
      setConfirmDialog((prev) => ({ ...prev, error: e?.message || `Failed to ${action} student` }));
    }
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((prev) => {
      if (visibleSelected) {
        setSelectedRows((rows) => {
          const next = { ...rows };
          visibleIds.forEach((id) => delete next[id]);
          return next;
        });
        return prev.filter((id) => !visibleIds.includes(id));
      }
      setSelectedRows((rows) => {
        const next = { ...rows };
        sortedFiltered.forEach((student) => {
          next[student.id] = student;
        });
        return next;
      });
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const toggleAllPagesSelection = async () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
      setSelectedRows({});
      return;
    }

    setLoadingList(true);
    try {
      const rows = await fetchAllMatchingStudents();
      setSelectedIds(rows.map((student) => student.id));
      setSelectedRows(Object.fromEntries(rows.map((student) => [student.id, student])));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to select all students.");
    } finally {
      setLoadingList(false);
    }
  };

  const toggleStudentSelection = (student: StudentRow) => {
    setSelectedIds((prev) => {
      if (prev.includes(student.id)) {
        setSelectedRows((rows) => {
          const next = { ...rows };
          delete next[student.id];
          return next;
        });
        return prev.filter((item) => item !== student.id);
      }
      setSelectedRows((rows) => ({ ...rows, [student.id]: student }));
      return [...prev, student.id];
    });
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

  const exportSelectedPdf = () => {
    const blob = buildStudentsPdf(selectedStudents);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `students-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice(`Exported ${selectedCount} selected students as PDF.`);
  };

  function openImportDialog() {
    setImportDialog({
      isOpen: true,
      fileName: "",
      rows: []
    });
  }

  function downloadStudentTemplate() {
    const csv = `${studentImportTemplateHeaders.map(csvCell).join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportDialog((prev) => ({ ...prev, isOpen: true, fileName: file.name, rows: [], error: "Use a CSV file exported from Excel." }));
      return;
    }

    try {
      const rows = parseStudentsCsv(await file.text());
      setImportDialog({
        isOpen: true,
        fileName: file.name,
        rows,
      });
    } catch (error) {
      setImportDialog((prev) => ({
        ...prev,
        isOpen: true,
        fileName: file.name,
        rows: [],
        error: error instanceof Error ? error.message : "Unable to read CSV file."
      }));
    }
  }

  function closeImportDialog() {
    if (importDialog.busy) return;
    setImportDialog({ isOpen: false, fileName: "", rows: [] });
  }

  async function submitImport() {
    if (importDialog.rows.length === 0) return;

    const classMap = new Map(classes.map((cls) => [classKey(cls.name, cls.section), cls.id]));

    // Resolve fee structures by name only when the CSV references them.
    let feeStructureMap: Map<string, string> | null = null;
    if (importDialog.rows.some((row) => row.feeStructure)) {
      try {
        const structures = await cachedFetch("fees:structures", () => apiFetch<{ id: string; name: string }[]>("/fees/structures"));
        feeStructureMap = new Map((structures || []).map((fs) => [fs.name.trim().toLowerCase(), fs.id]));
      } catch {
        setImportDialog((prev) => ({ ...prev, error: "Unable to load fee structures to match the feeStructure column." }));
        return;
      }
    }

    const payload = [];

    for (const row of importDialog.rows) {
      const classId = classMap.get(classKey(row.className, row.classSection));
      if (!classId) {
        setImportDialog((prev) => ({ ...prev, error: `Row ${row.rowNumber}: class not found. Add className and classSection in the CSV.` }));
        return;
      }

      let feeStructureId: string | undefined;
      if (row.feeStructure) {
        feeStructureId = feeStructureMap?.get(row.feeStructure.trim().toLowerCase());
        if (!feeStructureId) {
          setImportDialog((prev) => ({ ...prev, error: `Row ${row.rowNumber}: fee structure "${row.feeStructure}" not found.` }));
          return;
        }
      }

      payload.push({
        classId,
        fullName: row.fullName,
        parentName: row.parentName,
        parentPhone: row.parentPhone,
        alternatePhone: row.alternatePhone,
        gender: row.gender,
        rollNumber: row.rollNumber,
        dateOfBirth: row.dateOfBirth,
        aadhaar: row.aadhaar,
        apaar: row.apaar,
        previousSchool: row.previousSchool,
        siblingDiscount: row.siblingDiscount,
        transportRequired: row.transportRequired,
        transportFeeAmount: row.transportFeeAmount,
        feeStructureId,
        address: row.address,
        fatherName: row.fatherName,
        fatherPhone: row.fatherPhone,
        fatherOccupation: row.fatherOccupation,
        motherName: row.motherName,
        motherPhone: row.motherPhone,
        motherOccupation: row.motherOccupation,
        guardianName: row.guardianName,
        guardianPhone: row.guardianPhone,
        guardianOccupation: row.guardianOccupation
      });
    }

    setImportDialog((prev) => ({ ...prev, busy: true, error: undefined }));
    try {
      const result = await studentsApi.importStudents(payload);
      invalidateCachePrefix("students:list");
      setNotice(`Imported ${result.importedCount} students.`);
      setImportDialog({ isOpen: false, fileName: "", rows: [] });
      setPage(1);
      setSearch("");
      setClassId("");
      setLoadingList(true);
      const params = new URLSearchParams({ limit: perPage.toString(), page: "1" });
      const data = await apiFetch<{ items: ApiStudentItem[]; total: number }>(`/students?${params.toString()}`);
      const items = data?.items ?? [];
      setStudents(toStudentRows(items));
      setTotal(data?.total ?? 0);
    } catch (error) {
      setImportDialog((prev) => ({ ...prev, busy: false, error: error instanceof Error ? error.message : "Import failed" }));
    } finally {
      setLoadingList(false);
    }
  }

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
        const results = await Promise.allSettled(selectedStudents.map((student) =>
          communicationApi.sendMessage({
            targetType: "STUDENT",
            studentId: student.id,
            type: "CUSTOM",
            message
          })
        ));
        const queuedCount = results.filter((result) => result.status === "fulfilled").length;
        if (queuedCount === 0) {
          const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
          throw new Error(failure?.reason instanceof Error ? failure.reason.message : "Unable to queue WhatsApp messages.");
        }
        setNotice(
          queuedCount === selectedCount
            ? `Queued WhatsApp message for ${selectedCount} parents.`
            : `Queued WhatsApp message for ${queuedCount} of ${selectedCount} parents.`
        );
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
      setSelectedRows({});
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
          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleImportFile}
              type="file"
            />
            <button className="btn-secondary gap-1.5 text-[13px]" onClick={openImportDialog} type="button">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Import Students
            </button>
            <button className="btn-primary gap-1.5 text-[13px]" onClick={() => setShowCreateModal(true)} type="button">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Student
            </button>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
          <div className="relative sm:col-span-2 lg:w-72">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
            <input
              className="glass-input pl-10 lg:w-72"
              placeholder="Search student..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:flex lg:items-center">
            <CustomSelect
              ariaLabel="Filter by class"
              className="h-12 w-full rounded-[8px] text-[13px] lg:w-40"
              menuClassName="left-0 right-auto w-52"
              onChange={(value) => { setClassId(value); setPage(1); }}
              options={classOptions}
              value={classId}
              wrapperClassName="block w-full lg:w-auto"
            />
            {canViewFees ? (
              <CustomSelect
                ariaLabel="Filter by fee status"
                className="h-12 w-full rounded-[8px] text-[13px] lg:w-44"
                menuClassName="left-0 right-auto w-52"
                onChange={(value) => { setStatusFilter(value); setPage(1); }}
                options={feeStatusOptions}
                value={statusFilter}
                wrapperClassName="block w-full lg:w-auto"
              />
            ) : null}
            <button
              onClick={() => { setShowInactive(!showInactive); setPage(1); }}
              className={`flex h-12 min-w-0 items-center gap-2 rounded-[8px] border px-3 text-[13px] font-medium transition-all ${canViewFees ? "col-span-2 lg:w-44" : "lg:w-44"} ${showInactive
                  ? "bg-[#0071e3] border-[#0071e3] text-white shadow-[0_2px_10px_rgba(0,113,227,0.3)]"
                  : "bg-white border-[rgba(0,0,0,0.08)] text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}
            >
              <div className={`h-2 w-2 rounded-full ${showInactive ? "bg-white animate-pulse" : "bg-[#86868b]"}`} />
              <MarqueeText text={showInactive ? "Showing Inactive" : "Show Inactive Only"} className="min-w-0 flex-1 text-left" />
            </button>
          </div>
        </div>
        {selectedCount === 0 && (
          <button
            className="h-12 rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-white px-3.5 text-[13px] font-medium text-[#1d1d1f] transition-all duration-200 hover:bg-[#f5f5f7] disabled:opacity-40 disabled:hover:bg-white"
            disabled={resolvedTotal === 0}
            onClick={toggleAllPagesSelection}
            type="button"
          >
            {selectAllLabel}
          </button>
        )}
      </div>

      {notice ? (
        <div className="flex items-center justify-between rounded-xl border border-[#E2F0FB] bg-[#E2F0FB] px-4 py-3 text-[13px] font-semibold text-[#1F6FB8]">
          <span>{notice}</span>
          <button className="text-[#1F6FB8] underline-offset-2 hover:underline" onClick={() => setNotice(null)} type="button">Dismiss</button>
        </div>
      ) : null}

      {selectedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#DCE1E8] bg-white px-4 py-3 shadow-[0_8px_22px_-16px_rgba(15,20,25,0.35)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#0F1419]">Selected {selectedCount} Students</p>
            <p className="text-[12px] font-medium text-[#5A6573]">Bulk actions apply to all selected students across pages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" disabled={loadingList} onClick={toggleAllPagesSelection} type="button">
              {allFilteredSelected ? "Clear All Pages" : "Select All"}
            </button>
            <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => openBulkDialog("whatsapp")} type="button">Send WhatsApp</button>
            {isAdmin ? <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={() => openBulkDialog("promote")} type="button">Promote Class</button> : null}
            <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={exportSelectedCsv} type="button">Export CSV</button>
            <button className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={exportSelectedPdf} type="button">Export PDF</button>
            {isAdmin ? <button className="rounded-lg bg-[#C8242C] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#a51d24]" onClick={() => openBulkDialog("inactive")} type="button">Mark Inactive</button> : null}
            <button className="rounded-lg px-3 py-2 text-[12px] font-semibold text-[#5A6573] hover:bg-[#F7F8FB]" onClick={() => { setSelectedIds([]); setSelectedRows({}); }} type="button">Clear</button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white shadow-[var(--shadow-card)]">
        <div className="relative">
          {loadingList && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[8px] bg-white/60 backdrop-blur-[2px]">
              <div className="h-5 w-5 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse bg-white text-center text-[14px] text-[#001B33] ${canViewFees ? "min-w-[1120px]" : "min-w-[860px]"}`}>
              <thead>
                <tr className="table-head-row">
                  {tableHeaders.map((head, index) => (
                    <th
                      aria-sort={head.sortKey ? (sort.key === head.sortKey ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined}
                      key={`${head.label}-${index}`}
                      className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[14px] font-semibold text-[#031526]"
                    >
                      {index === 0 ? (
                        <input
                          aria-label="Select all visible students"
                          checked={visibleSelected}
                          className="h-4 w-4 rounded border-[#7A8390]"
                          onChange={toggleVisibleSelection}
                          type="checkbox"
                        />
                      ) : head.sortKey ? (
                        <button
                          className="inline-flex items-center justify-center gap-1.5 rounded-md px-1 py-0.5 hover:text-[#2456E6]"
                          onClick={() => handleSort(head.sortKey!)}
                          type="button"
                          title={`${head.label} ${sort.key === head.sortKey ? sortDirectionLabel(sort.direction) : ""}`.trim()}
                        >
                          {head.label}
                          <svg className={`h-3.5 w-3.5 text-[#52687D] ${sort.key === head.sortKey && sort.direction === "desc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24">
                            <path d="m8 14 4-4 4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </button>
                      ) : head.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loading || isInitialListLoading) && students.length === 0 ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-4 w-6 rounded-md" /></td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-4 w-6 rounded-md" /></td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-4 w-32 rounded-md" /></td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-4 w-12 rounded-md" /></td>
                      {canViewFees ? (
                        <>
                          <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-6 w-16 rounded-full" /></td>
                          <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-4 w-20 rounded-md" /></td>
                          <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-4 w-24 rounded-md" /></td>
                        </>
                      ) : null}
                      <td className="border-b border-[#C9D3DE] px-4 py-4"><Skeleton className="mx-auto h-4 w-12 rounded-md" /></td>
                      <td className="border-b border-[#C9D3DE] px-4 py-4"><div className="flex justify-center gap-2"><Skeleton className="h-7 w-14 rounded-lg" /><Skeleton className="h-7 w-14 rounded-lg" /></div></td>
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
                    const openUpward = sortedFiltered.length > 3 && idx >= sortedFiltered.length - 2;

                    return (
                      <tr key={student.id} className="group transition-colors duration-200 hover:bg-[#F8FBFD]" data-student-row>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                          <input
                            aria-label={`Select ${student.fullName}`}
                            checked={selectedIds.includes(student.id)}
                            className="h-4 w-4 rounded border-[#C2C9D4]"
                            onChange={() => toggleStudentSelection(student)}
                            type="checkbox"
                          />
                        </td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-medium text-[#52687D]">{rowNum}</td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-left">
                          <div className="grid w-full max-w-[260px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3">
                            <InitialsAvatar name={student.fullName} size="sm" />
                            <div className="min-w-0 text-left">
                              <Link className="font-semibold text-[#1d1d1f] transition-colors hover:text-[#2456E6]" href={`/students/${student.id}`}>
                                <MarqueeText text={student.fullName} className="max-w-[180px]" />
                              </Link>
                              <p className="mt-0.5 font-mono text-[11px] font-medium text-[#86868b]">{student.admissionNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-medium text-[#424B57]">{student.class.name}{student.class.section}</td>
                        {canViewFees ? (
                          <>
                            <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                              {student.feeStatus ? (
                                <StatusPill label={student.feeStatus} tone={feeStatusTone(student.feeStatus)} />
                              ) : (
                                <span className="text-[#86868b]">Not available</span>
                              )}
                            </td>
                            <td className={`whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold ${pendingAmountClass(student.currentOutstanding)}`}>
                              {student.currentOutstanding === null ? "-" : formatINR(student.currentOutstanding)}
                            </td>
                            <td className={`whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center font-semibold ${pendingAmountClass(student.pendingAmount)}`}>
                              {student.pendingAmount === null ? "-" : formatINR(student.pendingAmount)}
                            </td>
                            <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center text-[#424B57]">
                              <span>{student.lastPayment ? formatDateShort(student.lastPayment) : "-"}</span>
                              {student.lastPayment ? <span className="ml-1 text-[11px] text-[#86868b]">({timeAgo(student.lastPayment)})</span> : null}
                            </td>
                          </>
                        ) : null}
                        <td className="whitespace-nowrap border-b border-[#C9D3DE] px-4 py-4 text-center">
                          {student.attendancePercentage === null ? (
                            <span className="text-[#86868b]">-</span>
                          ) : (
                            <span className={`font-bold ${attendanceColor(student.attendancePercentage)}`}>
                              {student.attendancePercentage}%
                            </span>
                          )}
                        </td>
                        <td className="border-b border-[#C9D3DE] px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
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
                            {isTeacher ? (
                              <>
                                <Link
                                  href={`/teacher/communication?studentId=${student.id}`}
                                  className="inline-flex items-center rounded-lg border border-[#C2C9D4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#2A3340] transition-colors hover:bg-[#F7F8FB]"
                                >
                                  Message
                                </Link>
                                <Link
                                  href="/attendance"
                                  className="inline-flex items-center rounded-lg border border-[#C2C9D4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#2A3340] transition-colors hover:bg-[#F7F8FB]"
                                >
                                  Quick Mark
                                </Link>
                              </>
                            ) : null}
                            {(isAdmin || (canViewFees && student.feeStatus && student.feeStatus !== "PAID")) ? (
                              <div className="relative">
                                <button
                                  aria-expanded={menuOpen}
                                  aria-label={`More actions for ${student.fullName}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE1E8] bg-white text-[#5A6573] transition-colors hover:bg-[#F7F8FB]"
                                  data-row-action-button
                                  onClick={() => setOpenActionMenu(menuOpen ? null : student.id)}
                                  type="button"
                                >
                                  <span className="text-[16px] leading-none">...</span>
                                </button>
                                {menuOpen ? (
                                  <div
                                    className={`absolute right-0 z-30 min-w-[150px] overflow-hidden rounded-xl border border-[#DCE1E8] bg-white py-1 shadow-[0_12px_32px_-12px_rgba(15,20,25,0.35)] ${openUpward ? "bottom-8" : "top-8"}`}
                                    data-row-action-menu
                                  >
                                    {canViewFees && student.feeStatus && student.feeStatus !== "PAID" ? (
                                      <button
                                        className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
                                        onClick={() => setOpenActionMenu(null)}
                                        type="button"
                                      >
                                        Send Reminder
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

      </div>

      {/* ── Pagination ── */}
      <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {resolvedTotal > 0 ? (
          <p className="text-center text-[14px] font-semibold text-[#52687D] sm:text-left">
            Showing <span className="text-[#0F1419]">{displayStart}</span> to <span className="text-[#0F1419]">{displayEnd}</span> of <span className="text-[#0F1419]">{resolvedTotal}</span> students
          </p>
        ) : null}
        <div className="flex w-full flex-nowrap items-center justify-center gap-2 overflow-x-auto sm:w-auto sm:gap-3">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="min-h-[44px] shrink-0 rounded-[5px] border border-[#C9D3DE] px-3 text-[14px] font-semibold text-[#7A8390] transition hover:bg-[#F8FBFD] disabled:opacity-50 sm:px-4"
            type="button"
          >
            Previous
          </button>
          {pageNumbers.map((pg) => (
            <button
              key={pg}
              onClick={() => setPage(pg)}
              className={`min-h-[44px] min-w-[44px] shrink-0 rounded-[5px] border px-3 text-[14px] font-semibold transition ${page === pg ? "border-[#2456E6] bg-[#2456E6] text-white" : "border-[#C9D3DE] bg-white text-[#2456E6] hover:bg-[#F8FBFD]"}`}
              type="button"
            >
              {pg}
            </button>
          ))}
          <button
            disabled={page >= totalPages || resolvedTotal === 0}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-[44px] shrink-0 rounded-[5px] border border-[#C9D3DE] px-3 text-[14px] font-semibold text-[#2456E6] transition hover:bg-[#F8FBFD] disabled:opacity-50 sm:px-4"
            type="button"
          >
            Next
          </button>
        </div>
      </div>
      {importDialog.isOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-[#DCE1E8] px-6 py-4">
              <h3 className="text-[18px] font-semibold text-[#0F1419]">Import Students</h3>
              <p className="mt-1 text-[13px] font-medium text-[#5A6573]">{importDialog.fileName || "Use the ready CSV template, fill student data, then upload it here."}</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-[#DCE1E8] bg-[#F7F8FB] px-4 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F1419]">Download Empty CSV Template</p>
                    <p className="mt-1 text-[12px] font-medium leading-5 text-[#5A6573]">The file is prebuilt with all student import columns. Fill the rows in Excel or Google Sheets, save as .csv, then upload the filled file.</p>
                  </div>
                  <button
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#2456E6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2456E6] hover:bg-[#EEF3FF]"
                    onClick={downloadStudentTemplate}
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                    Download CSV
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-[#DCE1E8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[#0F1419]">{importDialog.fileName || "No file selected"}</p>
                  <p className="mt-1 text-[12px] font-medium text-[#5A6573]">Upload the completed template file.</p>
                </div>
                <button
                  className="rounded-lg bg-[#2456E6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1B45BD] disabled:bg-[#C2C9D4]"
                  disabled={importDialog.busy}
                  onClick={() => importInputRef.current?.click()}
                  type="button"
                >
                  Import Filled CSV
                </button>
              </div>
              {importDialog.error ? <div className="rounded-xl border border-[#FCE3E5] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{importDialog.error}</div> : null}
              {importDialog.rows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[#DCE1E8]">
                  <div className="border-b border-[#DCE1E8] bg-[#F7F8FB] px-4 py-2 text-[12px] font-semibold text-[#5A6573]">
                    Previewing {importDialog.rows.length} students
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full min-w-[640px] text-left text-[13px]">
                      <thead className="table-head sticky top-0">
                        <tr className="border-b border-[#DCE1E8] text-[11px] uppercase tracking-[0.06em] text-[#5A6573]">
                          <th className="px-4 py-2">Row</th>
                          <th className="px-4 py-2">Student</th>
                          <th className="px-4 py-2">Class</th>
                          <th className="px-4 py-2">Parent</th>
                          <th className="px-4 py-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importDialog.rows.slice(0, 20).map((row) => (
                          <tr className="border-b border-[#F0F2F5] last:border-0" key={`${row.rowNumber}-${row.fullName}`}>
                            <td className="px-4 py-2 text-[#5A6573]">{row.rowNumber}</td>
                            <td className="px-4 py-2 font-semibold text-[#0F1419]">{row.fullName}</td>
                            <td className="px-4 py-2">{row.className && row.classSection ? `${row.className}-${row.classSection}` : "Default"}</td>
                            <td className="px-4 py-2">{row.parentName}</td>
                            <td className="px-4 py-2">{row.parentPhone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importDialog.rows.length > 20 ? <p className="border-t border-[#DCE1E8] bg-[#F7F8FB] px-4 py-2 text-[12px] font-medium text-[#5A6573]">Showing first 20 rows only.</p> : null}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#DCE1E8] bg-[#F7F8FB] px-6 py-4">
              <button className="rounded-lg border border-[#C2C9D4] bg-white px-4 py-2 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" disabled={importDialog.busy} onClick={closeImportDialog} type="button">Cancel</button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2456E6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1B45BD] disabled:bg-[#C2C9D4] disabled:text-[#7A8390]"
                disabled={importDialog.busy || importDialog.rows.length === 0}
                onClick={submitImport}
                type="button"
              >
                {importDialog.busy ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
                {importDialog.busy ? "Importing..." : `Save ${importDialog.rows.length} Students`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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
                {bulkDialog.action === "whatsapp" ? "Send WhatsApp" : bulkDialog.action === "promote" ? "Promote Class" : "Mark Inactive"}
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
                  <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6573]">Target Class</span>
                  <CustomSelect
                    ariaLabel="Target class"
                    className="mt-2 h-11 w-full rounded-xl text-[14px]"
                    menuClassName="left-0 right-auto w-full"
                    onChange={(value) => setBulkDialog((prev) => ({ ...prev, targetClassId: value }))}
                    options={[{ label: "Select Class", value: "" }, ...classes.map((cls) => ({ label: `${cls.name}-${cls.section}`, value: cls.id }))]}
                    value={bulkDialog.targetClassId}
                    wrapperClassName="block w-full"
                  />
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

      {showCreateModal ? (
        <CreateStudentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            invalidateCachePrefix("students:");
            setPage(1);
            setLoadingList(true);
            const params = new URLSearchParams({ limit: perPage.toString(), page: "1" });
            if (search) params.set("search", search);
            if (classId) params.set("classId", classId);
            if (showInactive) params.set("showInactive", "true");
            apiFetch<{ items: ApiStudentItem[]; total: number }>(`/students?${params.toString()}`)
              .then((data) => {
                const { rows, total: nextTotal } = resolveStudentList(data?.items, data?.total, 1, perPage);
                setStudents(rows);
                setTotal(nextTotal);
              })
              .catch(console.error)
              .finally(() => setLoadingList(false));
          }}
        />
      ) : null}
    </div>
  );
}
