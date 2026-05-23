"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton, TableRowSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { cachedFetch, invalidateCache } from "@/lib/prefetchCache";

type TeacherPeriod = {
  id: string;
  dayOfWeek: Weekday;
  periodNumber: number;
  classId: string | null;
  subjectId: string | null;
  className: string;
  subjectName: string;
};

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

type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
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
  { id: "FRIDAY", label: "Friday", short: "Fri" }
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
      <PageHeader eyebrow="Teachers" title="Teacher management" action={isAdmin ? <Link href="/teachers/new" className="btn-primary">Add teacher</Link> : null} />

      <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <select className="glass-input text-[13px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="glass-input text-[13px]" value={classTeacherFilter} onChange={(event) => setClassTeacherFilter(event.target.value)}>
            <option value="">All class teachers</option>
            {classTeacherOptions.map((item) => (
              <option key={item} value={item}>Class {item}</option>
            ))}
          </select>
          <select className="glass-input text-[13px]" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="">All subjects</option>
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
            {showInactive ? "Showing inactive" : "Show inactive"}
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
                      <h2 className="truncate text-[15px] font-semibold text-[#1d1d1f]">{teacher.fullName}</h2>
                      <p className="mt-0.5 truncate text-[12px] font-medium text-[#52687D]">{teacher.email || teacher.phone || "-"}</p>
                    </div>
                  </div>
                  <StatusPill label={teacher.status} tone={statusTone(teacher.status)} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-[6px] bg-[#F7F8FB] p-3">
                    <p className="font-bold uppercase tracking-[0.08em] text-[#86868b]">Class teacher</p>
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
              {["Name", "Email", "Phone", "Class teacher", "Periods", "Status", ""].map((head, i) => (
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
                        <p className="font-semibold text-[#1d1d1f]">{teacher.fullName}</p>
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
                <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Manage classes and subjects</h2>
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
                          <option value="">Free period</option>
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
                            <option value="">Select subject</option>
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
                {assignmentSaving ? "Saving..." : "Save periods"}
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
    </div>
  );
}
