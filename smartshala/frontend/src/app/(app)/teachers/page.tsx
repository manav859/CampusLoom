"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton, TableRowSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { cachedFetch, invalidateCache } from "@/lib/prefetchCache";
import { CreateTeacherModal } from "./new/CreateTeacherModal";

type TeacherPeriod = {
  id: string;
  dayOfWeek: Weekday;
  periodNumber: number;
  classId: string | null;
  subjectId: string | null;
  className: string;
  subjectName: string;
};

const teacherImportTemplateHeaders = [
  "fullName",
  "phone",
  "email",
  "password",
  "gender",
  "dateOfBirth",
  "joiningDate",
  "designation",
  "address",
  "emergencyContact",
  "academicBackground"
];

type ImportTeacherRow = {
  rowNumber: number;
  fullName: string;
  phone: string;
  email?: string;
  password?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  joiningDate?: string;
  designation?: string;
  address?: string;
  emergencyContact?: string;
  academicBackground?: string;
};

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

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

// Accept yyyy-mm-dd or dd/mm/yyyy and return yyyy-mm-dd for the API.
function csvDateToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) throw new Error("Dates must be yyyy-mm-dd or dd/mm/yyyy.");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseTeachersCsv(text: string): ImportTeacherRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one teacher.");

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows: ImportTeacherRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index]);
    const raw: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      raw[header] = cells[cellIndex] ?? "";
    });

    const fullName = csvValue(raw, ["fullName", "name"]);
    const phone = csvValue(raw, ["phone", "mobile", "contact"]);
    const genderRaw = csvValue(raw, ["gender"]).toUpperCase();

    if (!fullName) throw new Error(`Row ${index + 1}: fullName is required.`);
    if (phone.length < 10) throw new Error(`Row ${index + 1}: a 10-digit phone is required.`);

    rows.push({
      rowNumber: index + 1,
      fullName,
      phone,
      email: csvValue(raw, ["email"]) || undefined,
      password: csvValue(raw, ["password"]) || undefined,
      gender: ["MALE", "FEMALE", "OTHER"].includes(genderRaw) ? (genderRaw as ImportTeacherRow["gender"]) : undefined,
      dateOfBirth: csvDateToIso(csvValue(raw, ["dateOfBirth", "dob"])),
      joiningDate: csvDateToIso(csvValue(raw, ["joiningDate", "doj"])),
      designation: csvValue(raw, ["designation", "title"]) || undefined,
      address: csvValue(raw, ["address"]) || undefined,
      emergencyContact: csvValue(raw, ["emergencyContact", "emergencyPhone"]) || undefined,
      academicBackground: csvValue(raw, ["academicBackground", "qualification"]) || undefined
    });
  }

  return rows;
}

type TeacherData = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  status: string;
  timetablePeriodCount?: number;
  periodAssignments?: TeacherPeriod[];
  classTeacherFor?: { id: string; name: string; section: string }[];
};

type TeacherAssignmentContext = {
  teacher: { id: string; fullName: string };
  days?: { id: Weekday; label: string }[];
  periodCount?: number;
  periods: TeacherPeriod[];
  classes: {
    id: string;
    name: string;
    section: string;
    academicYear: string;
    subjects: { id: string; name: string; teacherId: string | null }[];
  }[];
};

type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
type AssignmentDraft = Record<Weekday, Record<number, { classId: string; subjectId: string }>>;
type AssignmentConflict = {
  key: string;
  day: string;
  periodNumber: number;
  className: string;
  teacherName: string;
};

const timetableDays: { id: Weekday; label: string; short: string }[] = [
  { id: "MONDAY", label: "Monday", short: "Mon" },
  { id: "TUESDAY", label: "Tuesday", short: "Tue" },
  { id: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { id: "THURSDAY", label: "Thursday", short: "Thu" },
  { id: "FRIDAY", label: "Friday", short: "Fri" },
  { id: "SATURDAY", label: "Saturday", short: "Sat" }
];

function classLabel(classRecord: TeacherAssignmentContext["classes"][number]) {
  return `${classRecord.name}-${classRecord.section}`;
}

function classTeacherLabel(teacher: TeacherData) {
  const classes = teacher.classTeacherFor ?? [];
  return classes.length ? classes.map((item) => `${item.name}-${item.section}`).join(", ") : "None";
}

function assignedPeriodCount(teacher: TeacherData, periodCount = teacher.timetablePeriodCount ?? 8) {
  const validDays = new Set(timetableDays.map((day) => day.id));
  return (teacher.periodAssignments ?? []).filter((period) => period.classId && validDays.has(period.dayOfWeek) && period.periodNumber <= periodCount).length;
}

function totalTimetableSlots(periodCount: number) {
  return timetableDays.length * periodCount;
}

function statusTone(status: string) {
  return status === "ACTIVE" ? "good" : "warn";
}

function emptyAssignmentDraft(periodCount: number): AssignmentDraft {
  return Object.fromEntries(
    timetableDays.map((day) => [
      day.id,
      Object.fromEntries(Array.from({ length: periodCount }, (_, index) => [index + 1, { classId: "", subjectId: "" }]))
    ])
  ) as AssignmentDraft;
}

function draftFromPeriods(periods: TeacherPeriod[], periodCount: number): AssignmentDraft {
  const draft = emptyAssignmentDraft(periodCount);
  periods.forEach((period) => {
    const day = period.dayOfWeek || "MONDAY";
    if (!draft[day]?.[period.periodNumber]) return;
    draft[day][period.periodNumber] = { classId: period.classId ?? "", subjectId: period.subjectId ?? "" };
  });
  return draft;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [importDialog, setImportDialog] = useState<{ isOpen: boolean; fileName: string; rows: ImportTeacherRow[]; busy?: boolean; error?: string }>({
    isOpen: false,
    fileName: "",
    rows: []
  });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [classTeacherFilter, setClassTeacherFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [assignmentContext, setAssignmentContext] = useState<TeacherAssignmentContext | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(() => emptyAssignmentDraft(8));
  const [activeAssignmentDay, setActiveAssignmentDay] = useState<Weekday>("MONDAY");
  const [copySourceDay, setCopySourceDay] = useState<Weekday>("MONDAY");
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: "activate" | "deactivate"; teacherId: string | null; error?: string }>({
    isOpen: false,
    action: "deactivate",
    teacherId: null
  });
  const [resetPassword, setResetPassword] = useState<{ teacher: TeacherData | null; password: string; confirm: string; saving: boolean; error: string; success: boolean }>({
    teacher: null,
    password: "",
    confirm: "",
    saving: false,
    error: "",
    success: false
  });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setIsAdmin(u.role === "ADMIN" || u.role === "PRINCIPAL");
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  async function refreshTeachers(useCache = false) {
    const cacheKey = showInactive ? "teachers:list:inactive" : "teachers:list";
    const fetcher = () => apiFetch<{ items: TeacherData[] }>(`/users/teachers?limit=100${showInactive ? "&showInactive=true" : ""}`);
    const data = useCache ? await cachedFetch(cacheKey, fetcher) : await fetcher();
    setTeachers(data?.items || []);
  }

  useEffect(() => {
    setLoading(true);
    refreshTeachers(true)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [showInactive]);

  function openImportDialog() {
    setImportDialog({ isOpen: true, fileName: "", rows: [] });
  }

  function downloadTeacherTemplate() {
    const csv = `${teacherImportTemplateHeaders.map(csvCell).join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "teacher-import-template.csv";
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
      const rows = parseTeachersCsv(await file.text());
      setImportDialog({ isOpen: true, fileName: file.name, rows });
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
    const teachers = importDialog.rows.map((row) => ({
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      // Teachers sign in with a password; when the CSV leaves it blank, default
      // it to the phone number so the account is usable. Admin can reset it.
      password: row.password && row.password.length >= 6 ? row.password : row.phone,
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      joiningDate: row.joiningDate,
      designation: row.designation,
      address: row.address,
      emergencyContact: row.emergencyContact,
      academicBackground: row.academicBackground
    }));

    setImportDialog((prev) => ({ ...prev, busy: true, error: undefined }));
    try {
      const result = await apiFetch<{ importedCount: number }>("/users/teachers/import", {
        method: "POST",
        body: JSON.stringify({ teachers })
      });
      invalidateCache("teachers:list");
      invalidateCache("teachers:list:inactive");
      setImportDialog({ isOpen: false, fileName: "", rows: [] });
      setNotice(`Imported ${result.importedCount} teacher${result.importedCount === 1 ? "" : "s"}.`);
      await refreshTeachers();
    } catch (error) {
      setImportDialog((prev) => ({ ...prev, busy: false, error: error instanceof Error ? error.message : "Import failed" }));
    }
  }

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

  async function openAssignments(teacherId: string) {
    const teacher = teachers.find((item) => item.id === teacherId);
    const periods = teacher?.periodAssignments ?? [];
    const periodCount = teacher?.timetablePeriodCount ?? 8;
    setActiveAssignmentDay("MONDAY");
    setCopySourceDay("MONDAY");
    setAssignmentContext({
      teacher: { id: teacherId, fullName: teacher?.fullName ?? "Teacher" },
      days: timetableDays.map(({ id, label }) => ({ id, label })),
      periodCount,
      periods,
      classes: []
    });
    setAssignmentDraft(draftFromPeriods(periods, periodCount));
    setAssignmentLoading(true);
    setAssignmentError("");
    try {
      const data = await cachedFetch(`teacher:${teacherId}:assignments`, () => apiFetch<TeacherAssignmentContext>(`/users/teachers/${teacherId}/assignments`));
      setAssignmentContext(data);
      setAssignmentDraft(draftFromPeriods(data.periods, data.periodCount ?? 8));
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : "Unable to load teacher assignments");
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function saveAssignments() {
    if (!assignmentContext) return;
    const periodCount = assignmentContext.periodCount ?? 8;
    setAssignmentSaving(true);
    setAssignmentError("");
    try {
      const periods = timetableDays.flatMap((day) =>
        Array.from({ length: periodCount }, (_, index) => {
          const periodNumber = index + 1;
          const draft = assignmentDraft[day.id]?.[periodNumber] ?? { classId: "", subjectId: "" };
          return {
            dayOfWeek: day.id,
            periodNumber,
            classId: draft.classId || null,
            subjectId: draft.classId ? draft.subjectId || null : null
          };
        })
      );
      const updated = await apiFetch<TeacherAssignmentContext>(`/users/teachers/${assignmentContext.teacher.id}/assignments`, {
        method: "PUT",
        body: JSON.stringify({ periods })
      });
      invalidateCache(`teacher:${assignmentContext.teacher.id}:assignments`);
      setAssignmentContext(updated);
      setAssignmentDraft(draftFromPeriods(updated.periods, updated.periodCount ?? periodCount));
      await refreshTeachers();
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : "Unable to save teacher assignments");
    } finally {
      setAssignmentSaving(false);
    }
  }

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, action: "deactivate", teacherId: id });
  };

  const handleActivate = (id: string) => {
    setConfirmDialog({ isOpen: true, action: "activate", teacherId: id });
  };

  const handleResetPassword = (teacher: TeacherData) => {
    setResetPassword({ teacher, password: "", confirm: "", saving: false, error: "", success: false });
  };

  const submitResetPassword = async () => {
    const { teacher, password, confirm } = resetPassword;
    if (!teacher) return;
    if (password.length < 6) {
      setResetPassword((prev) => ({ ...prev, error: "Password must be at least 6 characters." }));
      return;
    }
    if (password !== confirm) {
      setResetPassword((prev) => ({ ...prev, error: "Passwords do not match." }));
      return;
    }
    setResetPassword((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      await apiFetch(`/users/teachers/${teacher.id}/password`, { method: "PATCH", body: JSON.stringify({ password }) });
      setResetPassword((prev) => ({ ...prev, saving: false, success: true }));
    } catch (error: any) {
      setResetPassword((prev) => ({ ...prev, saving: false, error: error?.message || "Failed to reset password." }));
    }
  };

  const handleConfirmAction = async () => {
    const { teacherId, action } = confirmDialog;
    if (!teacherId) return;

    try {
      if (action === "deactivate") await apiFetch(`/users/${teacherId}`, { method: "DELETE" });
      else await apiFetch(`/users/${teacherId}/activate`, { method: "PATCH" });
      setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
      setConfirmDialog({ isOpen: false, action: "deactivate", teacherId: null });
    } catch (error: any) {
      setConfirmDialog((prev) => ({ ...prev, error: error?.message || `Failed to ${action} teacher` }));
    }
  };

  const classTeacherOptions = Array.from(
    new Set(
      teachers.flatMap((teacher) => (teacher.classTeacherFor ?? []).map((item) => `${item.name}-${item.section}`))
    )
  ).sort((left, right) => left.localeCompare(right));

  const subjectOptions = Array.from(
    new Set(
      teachers.flatMap((teacher) =>
        (teacher.periodAssignments ?? [])
          .filter((period) => period.subjectId && period.subjectName)
          .map((period) => period.subjectName)
      )
    )
  ).sort((left, right) => left.localeCompare(right));

  const filteredTeachers = teachers.filter((teacher) => {
    const statusMatches = !statusFilter || teacher.status === statusFilter;
    const classTeacherMatches = !classTeacherFilter || (teacher.classTeacherFor ?? []).some((item) => `${item.name}-${item.section}` === classTeacherFilter);
    const subjectMatches = !subjectFilter || (teacher.periodAssignments ?? []).some((period) => period.subjectName === subjectFilter);
    return statusMatches && classTeacherMatches && subjectMatches;
  });

  const activeDayLabel = timetableDays.find((day) => day.id === activeAssignmentDay)?.label ?? "Monday";
  const assignmentPeriodCount = assignmentContext?.periodCount ?? 8;
  const assignmentConflicts: AssignmentConflict[] = assignmentContext
    ? timetableDays.flatMap((day) =>
        Array.from({ length: assignmentPeriodCount }, (_, index) => {
          const periodNumber = index + 1;
          const draft = assignmentDraft[day.id]?.[periodNumber];
          if (!draft?.classId) return null;
          const conflictTeacher = teachers.find((teacher) =>
            teacher.id !== assignmentContext.teacher.id &&
            (teacher.periodAssignments ?? []).some((period) =>
              period.dayOfWeek === day.id &&
              period.periodNumber === periodNumber &&
              period.classId === draft.classId
            )
          );
          if (!conflictTeacher) return null;
          const selectedClass = assignmentContext.classes.find((item) => item.id === draft.classId);
          return {
            key: `${day.id}:${periodNumber}`,
            day: day.label,
            periodNumber,
            className: selectedClass ? classLabel(selectedClass) : "Selected class",
            teacherName: conflictTeacher.fullName
          };
        }).filter((item): item is AssignmentConflict => Boolean(item))
      )
    : [];
  const hasAssignmentConflicts = assignmentConflicts.length > 0;

  function copyAssignmentsFromDay() {
    if (!assignmentContext || copySourceDay === activeAssignmentDay) return;
    setAssignmentDraft((current) => ({
      ...current,
      [activeAssignmentDay]: Object.fromEntries(
        Array.from({ length: assignmentPeriodCount }, (_, index) => {
          const periodNumber = index + 1;
          const source = current[copySourceDay]?.[periodNumber] ?? { classId: "", subjectId: "" };
          return [periodNumber, { ...source }];
        })
      ) as AssignmentDraft[Weekday]
    }));
  }

  function repeatActiveDayForWeekdays() {
    if (!assignmentContext) return;
    setAssignmentDraft((current) => {
      const sourceDay = current[activeAssignmentDay] ?? {};
      return Object.fromEntries(
        timetableDays.map((day) => [
          day.id,
          Object.fromEntries(
            Array.from({ length: assignmentPeriodCount }, (_, index) => {
              const periodNumber = index + 1;
              const source = sourceDay[periodNumber] ?? { classId: "", subjectId: "" };
              return [periodNumber, { ...source }];
            })
          )
        ])
      ) as AssignmentDraft;
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        hideBreadcrumbs
        title="Teacher Management"
        action={isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/teachers/attendance" className="btn-secondary text-[#1d1d1f]">Teacher Attendance</Link>
            <button onClick={openImportDialog} className="btn-secondary text-[#1d1d1f]" type="button">Import CSV</button>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary" type="button">Add Teacher</button>
          </div>
        ) : null}
      />

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-[6px] border border-[#BEE7CD] bg-[#F1FFF6] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">
          <span>{notice}</span>
          <button className="text-[12px] font-bold text-[#0F8A4A] hover:underline" onClick={() => setNotice("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <select className="glass-input text-[13px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="glass-input text-[13px]" value={classTeacherFilter} onChange={(event) => setClassTeacherFilter(event.target.value)}>
            <option value="">All Class Teachers</option>
            {classTeacherOptions.map((item) => (
              <option key={item} value={item}>Class {item}</option>
            ))}
          </select>
          <select className="glass-input text-[13px]" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="">All Subjects</option>
            {subjectOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-[6px] border px-3 text-[13px] font-semibold transition-all ${
              showInactive ? "border-[#2456E6] bg-[#2456E6] text-white shadow-[0_2px_10px_rgba(36,86,230,0.24)]" : "border-[#C9D3DE] bg-white text-[#1d1d1f] hover:bg-[#F7F8FB]"
            }`}
            type="button"
          >
            <div className={`h-2 w-2 rounded-full ${showInactive ? "bg-white" : "bg-[#86868b]"}`} />
            {showInactive ? "Showing Inactive" : "Show Inactive"}
          </button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]" key={index}>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
              <Skeleton className="mt-4 h-16 w-full rounded-md" />
            </div>
          ))
        ) : filteredTeachers.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-[#C9D3DE] bg-[#F7F8FB] px-4 py-10 text-center text-[13px] font-medium text-[#52687D]">
            No teachers found.
          </div>
        ) : (
          filteredTeachers.map((teacher) => {
            const assigned = assignedPeriodCount(teacher);
            const total = totalTimetableSlots(teacher.timetablePeriodCount ?? 8);
            return (
              <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]" key={teacher.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <InitialsAvatar name={teacher.fullName} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/teachers/${teacher.id}`} className="block truncate text-[15px] font-semibold text-[#1d1d1f] hover:text-[#2456E6]">{teacher.fullName}</Link>
                      <p className="mt-0.5 truncate text-[12px] font-medium text-[#52687D]">{teacher.email || teacher.phone || "-"}</p>
                    </div>
                  </div>
                  <StatusPill label={teacher.status} tone={statusTone(teacher.status)} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3">
                    <p className="font-bold uppercase tracking-[0.08em] text-[#86868b]">Class Teacher</p>
                    <p className="mt-1 font-semibold text-[#1d1d1f]">{classTeacherLabel(teacher)}</p>
                  </div>
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3">
                    <p className="font-bold uppercase tracking-[0.08em] text-[#86868b]">Periods</p>
                    <p className="mt-1 font-semibold text-[#1d1d1f]">{assigned}/{total} assigned</p>
                  </div>
                </div>

                <div className="mt-3 rounded-[6px] bg-[#F7F8FB] p-3 text-[12px]">
                  <p className="font-bold uppercase tracking-[0.08em] text-[#86868b]">Phone</p>
                  <p className="mt-1 font-semibold text-[#1d1d1f]">{teacher.phone || "-"}</p>
                </div>

                {isAdmin ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/teachers/${teacher.id}/edit`} className="inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[13px] font-semibold text-[#2456E6]">
                      Edit
                    </Link>
                    <button onClick={() => openAssignments(teacher.id)} className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-[#2456E6] px-3 text-[13px] font-semibold text-white" type="button">
                      Manage
                    </button>
                    <button onClick={() => handleResetPassword(teacher)} className="col-span-2 inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[13px] font-semibold text-[#1d1d1f]" type="button">
                      Reset Password
                    </button>
                    {teacher.status === "ACTIVE" ? (
                      <button onClick={() => handleDelete(teacher.id)} className="col-span-2 inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#F0B8BC] bg-[#FFF5F5] px-3 text-[13px] font-semibold text-[#C8242C]" type="button">
                        Deactivate
                      </button>
                    ) : (
                      <button onClick={() => handleActivate(teacher.id)} className="col-span-2 inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#BEE7CD] bg-[#F1FFF6] px-3 text-[13px] font-semibold text-[#0F8A4A]" type="button">
                        Activate
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)] md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="table-head">
            <tr>
              {["Name", "Email", "Phone", "Class Teacher", "Periods", "Status", ""].map((head, i) => (
                <th className="px-5 py-3.5 font-semibold" key={i}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
            ) : filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[#86868b]">No teachers found.</td>
              </tr>
            ) : (
              filteredTeachers.map((teacher, index) => {
                const menuOpen = openActionMenu === teacher.id;
                const openUpward = filteredTeachers.length > 3 && index >= filteredTeachers.length - 2;

                return (
                <tr key={teacher.id} className="table-row">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={teacher.fullName} size="sm" />
                      <div>
                        <Link href={`/teachers/${teacher.id}`} className="font-semibold text-[#1d1d1f] hover:text-[#2456E6]">{teacher.fullName}</Link>
                        <p className="mt-0.5 text-[11px] font-medium text-[#86868b]">
                          {assignedPeriodCount(teacher)}/{totalTimetableSlots(teacher.timetablePeriodCount ?? 8)} weekly periods assigned
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[#6e6e73]">{teacher.email || "-"}</td>
                  <td className="px-5 py-4 text-[#6e6e73]">{teacher.phone || "-"}</td>
                  <td className="px-5 py-4 text-[#6e6e73]">
                    {classTeacherLabel(teacher)}
                  </td>
                  <td className="px-5 py-4 text-[#6e6e73]">
                    {assignedPeriodCount(teacher)}/{totalTimetableSlots(teacher.timetablePeriodCount ?? 8)} assigned
                  </td>
                  <td className="px-5 py-4"><StatusPill label={teacher.status} tone={statusTone(teacher.status)} /></td>
                  <td className="px-5 py-4 text-right">
                    {isAdmin ? (
                      <div className="flex justify-end gap-2">
                        <Link href={`/teachers/${teacher.id}/edit`} className="inline-flex items-center rounded-lg bg-[#0071e3]/10 px-3 py-1.5 text-[11px] font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white transition-colors">
                          Edit
                        </Link>
                        <button onClick={() => openAssignments(teacher.id)} className="inline-flex items-center rounded-lg bg-[#0071e3]/10 px-3 py-1.5 text-[11px] font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white transition-colors">
                          Manage
                        </button>
                        <div className="relative">
                          <button
                            aria-expanded={menuOpen}
                            aria-label={`More actions for ${teacher.fullName}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE1E8] bg-white text-[#5A6573] transition-colors hover:bg-[#F7F8FB]"
                            data-row-action-button
                            onClick={() => setOpenActionMenu(menuOpen ? null : teacher.id)}
                            type="button"
                          >
                            <span className="text-[16px] leading-none">...</span>
                          </button>
                          {menuOpen ? (
                            <div
                              className={`absolute right-0 z-30 min-w-[140px] overflow-hidden rounded-xl border border-[#DCE1E8] bg-white py-1 shadow-[0_12px_32px_-12px_rgba(15,20,25,0.35)] ${openUpward ? "bottom-8" : "top-8"}`}
                              data-row-action-menu
                            >
                              <button
                                className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#F1F3F6]"
                                onClick={() => {
                                  setOpenActionMenu(null);
                                  handleResetPassword(teacher);
                                }}
                                type="button"
                              >
                                Reset Password
                              </button>
                              {teacher.status === "ACTIVE" ? (
                                <button
                                  className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5]"
                                  onClick={() => {
                                    setOpenActionMenu(null);
                                    handleDelete(teacher.id);
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
                                    handleActivate(teacher.id);
                                  }}
                                  type="button"
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {assignmentContext && typeof window !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[6px] bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(0,0,0,0.06)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Manage Classes and Subjects</h2>
                <p className="mt-0.5 text-[13px] text-[#86868b]">
                  {assignmentContext.teacher.fullName} gets {assignmentPeriodCount} periods per day. Leave class as free period when unassigned.
                </p>
              </div>
              <button className="min-h-9 rounded-[6px] border border-[#DCE1E8] px-3 text-[13px] font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]" onClick={() => setAssignmentContext(null)} type="button">Close</button>
            </div>

            <div className="min-h-0 overflow-auto p-4 sm:p-5">
              {assignmentError ? <div className="mb-4 rounded-xl bg-[#ff3b30]/10 p-3 text-[13px] font-medium text-[#d70015]">{assignmentError}</div> : null}
              {assignmentLoading ? (
                <p className="py-10 text-center text-[13px] text-[#86868b]">Loading assignments...</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {timetableDays.map((day) => (
                      <button
                        className={`rounded-xl px-3 py-2 text-[12px] font-bold transition-colors ${
                          activeAssignmentDay === day.id ? "bg-[#1d1d1f] text-white" : "border border-[#DCE1E8] bg-white text-[#5A6573] hover:bg-[#F7F8FB]"
                        }`}
                        key={day.id}
                        onClick={() => setActiveAssignmentDay(day.id)}
                        type="button"
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-[#DCE1E8] bg-[#F7F8FB] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[#1d1d1f]">{activeDayLabel} timetable</p>
                      <p className="text-[12px] font-medium text-[#86868b]">Copy a known day or repeat this day across weekdays.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="rounded-xl border border-[#DCE1E8] bg-white px-3 py-2 text-[12px] font-semibold text-[#1d1d1f] outline-none"
                        onChange={(event) => setCopySourceDay(event.target.value as Weekday)}
                        value={copySourceDay}
                      >
                        {timetableDays.map((day) => (
                          <option key={day.id} value={day.id}>{day.label}</option>
                        ))}
                      </select>
                      <button className="rounded-xl border border-[#DCE1E8] bg-white px-3 py-2 text-[12px] font-bold text-[#1d1d1f] hover:bg-[#F1F3F6]" onClick={copyAssignmentsFromDay} type="button">
                        Copy to {activeDayLabel}
                      </button>
                      <button className="rounded-xl bg-[#E2F0FB] px-3 py-2 text-[12px] font-bold text-[#1F6FB8] hover:bg-[#d4e9fb]" onClick={repeatActiveDayForWeekdays} type="button">
                        Repeat for weekdays
                      </button>
                    </div>
                  </div>

                  {hasAssignmentConflicts ? (
                    <div className="rounded-xl bg-[#ff9500]/10 p-3 text-[13px] font-semibold text-[#9A4D00]">
                      {assignmentConflicts.slice(0, 3).map((conflict) => (
                        <p key={conflict.key}>
                          Class {conflict.className} already has {conflict.teacherName} on {conflict.day}, period {conflict.periodNumber}.
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {Array.from({ length: assignmentPeriodCount }, (_, index) => {
                    const periodNumber = index + 1;
                    const draft = assignmentDraft[activeAssignmentDay]?.[periodNumber] ?? { classId: "", subjectId: "" };
                    const selectedClass = assignmentContext.classes.find((item) => item.id === draft.classId);
                    const subjects = selectedClass?.subjects ?? [];
                    const conflict = assignmentConflicts.find((item) => item.key === `${activeAssignmentDay}:${periodNumber}`);

                    return (
                      <div className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[80px_1fr_1fr] ${conflict ? "border-[#ff9500] bg-[#ff9500]/[0.04]" : "border-[rgba(0,0,0,0.06)]"}`} key={periodNumber}>
                        <div className="flex items-center text-[13px] font-semibold text-[#1d1d1f]">Period {periodNumber}</div>
                        <select
                          className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[#0071e3]"
                          value={draft.classId}
                          onChange={(event) =>
                            setAssignmentDraft((current) => ({
                              ...current,
                              [activeAssignmentDay]: {
                                ...current[activeAssignmentDay],
                                [periodNumber]: { classId: event.target.value, subjectId: "" }
                              }
                            }))
                          }
                        >
                          <option value="">Free Period</option>
                          {assignmentContext.classes.map((classRecord) => (
                            <option key={classRecord.id} value={classRecord.id}>Class {classLabel(classRecord)}</option>
                          ))}
                        </select>
                        {draft.classId ? (
                          <select
                            className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[#0071e3]"
                            value={draft.subjectId}
                            onChange={(event) =>
                              setAssignmentDraft((current) => ({
                                ...current,
                                [activeAssignmentDay]: {
                                  ...current[activeAssignmentDay],
                                  [periodNumber]: { ...draft, subjectId: event.target.value }
                                }
                              }))
                            }
                          >
                            <option value="">Select Subject</option>
                            {subjects.map((subject) => (
                              <option key={subject.id} value={subject.id}>{subject.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center rounded-xl bg-[#F7F8FB] px-3 py-2 text-[13px] font-semibold text-[#86868b]">
                            Free period - no subject needed
                          </div>
                        )}
                        {conflict ? (
                          <p className="sm:col-start-2 sm:col-span-2 text-[12px] font-semibold text-[#9A4D00]">
                            Conflict with {conflict.teacherName}.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[rgba(0,0,0,0.06)] bg-[#f5f5f7]/60 px-4 py-4 sm:flex sm:justify-end sm:px-5">
              <button className="min-h-10 rounded-[6px] px-4 text-[13px] font-semibold text-[#1d1d1f] hover:bg-white" onClick={() => setAssignmentContext(null)} type="button">Cancel</button>
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] bg-[#1d1d1f] px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={assignmentSaving || hasAssignmentConflicts} onClick={saveAssignments} type="button">
                {assignmentSaving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
                {assignmentSaving ? "Saving..." : "Save Periods"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {confirmDialog.isOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">{confirmDialog.action === "deactivate" ? "Deactivate Teacher" : "Activate Teacher"}</h3>
              <p className="mt-2 text-[13px] text-[#86868b]">Are you sure you want to {confirmDialog.action} this teacher?</p>
              {confirmDialog.error ? <div className="mt-4 rounded-lg bg-[rgba(255,59,48,0.1)] p-3 text-left text-[12px] font-medium text-[#d70015]">{confirmDialog.error}</div> : null}
            </div>
            <div className="flex border-t border-[rgba(0,0,0,0.06)] bg-[#f5f5f7]/50">
              <button onClick={() => setConfirmDialog({ isOpen: false, action: "deactivate", teacherId: null })} className="flex-1 py-3 text-[14px] font-medium text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors border-r border-[rgba(0,0,0,0.06)]">Cancel</button>
              <button onClick={handleConfirmAction} className={`flex-1 py-3 text-[14px] font-semibold transition-colors ${confirmDialog.action === "deactivate" ? "text-[#ff3b30] hover:bg-[#ff3b30]/10" : "text-[#34c759] hover:bg-[#34c759]/10"}`}>
                {confirmDialog.action === "deactivate" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {resetPassword.teacher && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
              <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Reset Password</h3>
              <p className="mt-0.5 text-[13px] text-[#86868b]">Set a new login password for {resetPassword.teacher.fullName}.</p>
            </div>
            {resetPassword.success ? (
              <div className="px-5 py-6">
                <div className="rounded-lg bg-[#34c759]/10 p-3 text-[13px] font-medium text-[#0F8A4A]">
                  Password updated. Share the new password with the teacher.
                </div>
              </div>
            ) : (
              <div className="space-y-3 px-5 py-5">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#52687D]">New Password</label>
                  <input
                    autoFocus
                    type="password"
                    className="glass-input w-full text-[13px]"
                    placeholder="At least 6 characters"
                    value={resetPassword.password}
                    onChange={(event) => setResetPassword((prev) => ({ ...prev, password: event.target.value, error: "" }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#52687D]">Confirm Password</label>
                  <input
                    type="password"
                    className="glass-input w-full text-[13px]"
                    placeholder="Re-enter password"
                    value={resetPassword.confirm}
                    onChange={(event) => setResetPassword((prev) => ({ ...prev, confirm: event.target.value, error: "" }))}
                  />
                </div>
                {resetPassword.error ? <div className="rounded-lg bg-[rgba(255,59,48,0.1)] p-3 text-[12px] font-medium text-[#d70015]">{resetPassword.error}</div> : null}
              </div>
            )}
            <div className="flex border-t border-[rgba(0,0,0,0.06)] bg-[#f5f5f7]/50">
              <button
                onClick={() => setResetPassword((prev) => ({ ...prev, teacher: null }))}
                className="flex-1 border-r border-[rgba(0,0,0,0.06)] py-3 text-[14px] font-medium text-[#1d1d1f] transition-colors hover:bg-[#e5e5ea]"
                type="button"
              >
                {resetPassword.success ? "Close" : "Cancel"}
              </button>
              {resetPassword.success ? null : (
                <button
                  onClick={submitResetPassword}
                  disabled={resetPassword.saving}
                  className="flex-1 py-3 text-[14px] font-semibold text-[#0071e3] transition-colors hover:bg-[#0071e3]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                >
                  {resetPassword.saving ? "Saving..." : "Reset Password"}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />

      {importDialog.isOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-[#DCE1E8] px-6 py-4">
              <h3 className="text-[18px] font-semibold text-[#0F1419]">Import Teachers</h3>
              <p className="mt-1 text-[13px] font-medium text-[#5A6573]">{importDialog.fileName || "Download the CSV template, fill in the teachers, then upload it here."}</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-[#DCE1E8] bg-[#F7F8FB] px-4 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F1419]">Download Empty CSV Template</p>
                    <p className="mt-1 text-[12px] font-medium leading-5 text-[#5A6573]">Prebuilt with every teacher column. <span className="font-semibold">fullName</span> and <span className="font-semibold">phone</span> are required; leave <span className="font-semibold">password</span> blank to default it to the phone number.</p>
                  </div>
                  <button
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#2456E6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2456E6] hover:bg-[#EEF3FF]"
                    onClick={downloadTeacherTemplate}
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
                  Choose CSV File
                </button>
              </div>
              {importDialog.error ? <div className="rounded-xl border border-[#FCE3E5] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{importDialog.error}</div> : null}
              {importDialog.rows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[#DCE1E8]">
                  <div className="border-b border-[#DCE1E8] bg-[#F7F8FB] px-4 py-2 text-[12px] font-semibold text-[#5A6573]">
                    Previewing {importDialog.rows.length} teacher{importDialog.rows.length === 1 ? "" : "s"}
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full min-w-[560px] text-left text-[13px]">
                      <thead className="table-head sticky top-0">
                        <tr className="border-b border-[#DCE1E8] text-[11px] uppercase tracking-[0.06em] text-[#5A6573]">
                          <th className="px-4 py-2">Row</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Phone</th>
                          <th className="px-4 py-2">Email</th>
                          <th className="px-4 py-2">Designation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importDialog.rows.slice(0, 20).map((row) => (
                          <tr className="border-b border-[#F0F2F5] last:border-0" key={`${row.rowNumber}-${row.fullName}`}>
                            <td className="px-4 py-2 text-[#5A6573]">{row.rowNumber}</td>
                            <td className="px-4 py-2 font-semibold text-[#0F1419]">{row.fullName}</td>
                            <td className="px-4 py-2">{row.phone}</td>
                            <td className="px-4 py-2 text-[#5A6573]">{row.email || <span className="italic text-[#86868b]">—</span>}</td>
                            <td className="px-4 py-2 text-[#5A6573]">{row.designation || <span className="italic text-[#86868b]">—</span>}</td>
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
                {importDialog.busy ? "Importing..." : `Save ${importDialog.rows.length} Teacher${importDialog.rows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCreateModal ? (
        <CreateTeacherModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            invalidateCache("teachers:list");
            invalidateCache("teachers:list:inactive");
            refreshTeachers();
          }}
        />
      ) : null}
    </div>
  );
}
