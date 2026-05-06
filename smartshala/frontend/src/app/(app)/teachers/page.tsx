"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { cachedFetch } from "@/lib/prefetchCache";

type TeacherPeriod = {
  id: string;
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
  periodAssignments?: TeacherPeriod[];
  classTeacherFor?: { id: string; name: string; section: string }[];
};

type TeacherAssignmentContext = {
  teacher: { id: string; fullName: string };
  periods: TeacherPeriod[];
  classes: {
    id: string;
    name: string;
    section: string;
    academicYear: string;
    subjects: { id: string; name: string; teacherId: string | null }[];
  }[];
};

function classLabel(classRecord: TeacherAssignmentContext["classes"][number]) {
  return `${classRecord.name}-${classRecord.section}`;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [assignmentContext, setAssignmentContext] = useState<TeacherAssignmentContext | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<Record<number, { classId: string; subjectId: string }>>({});
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

  async function openAssignments(teacherId: string) {
    setAssignmentLoading(true);
    setAssignmentError("");
    try {
      const data = await apiFetch<TeacherAssignmentContext>(`/users/teachers/${teacherId}/assignments`);
      setAssignmentContext(data);
      setAssignmentDraft(Object.fromEntries(data.periods.map((period) => [period.periodNumber, { classId: period.classId ?? "", subjectId: period.subjectId ?? "" }])));
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : "Unable to load teacher assignments");
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function saveAssignments() {
    if (!assignmentContext) return;
    setAssignmentSaving(true);
    setAssignmentError("");
    try {
      const periods = Array.from({ length: 8 }, (_, index) => {
        const periodNumber = index + 1;
        const draft = assignmentDraft[periodNumber] ?? { classId: "", subjectId: "" };
        return {
          periodNumber,
          classId: draft.classId || null,
          subjectId: draft.classId ? draft.subjectId || null : null
        };
      });
      const updated = await apiFetch<TeacherAssignmentContext>(`/users/teachers/${assignmentContext.teacher.id}/assignments`, {
        method: "PUT",
        body: JSON.stringify({ periods })
      });
      setAssignmentContext(updated);
      setAssignmentDraft(Object.fromEntries(updated.periods.map((period) => [period.periodNumber, { classId: period.classId ?? "", subjectId: period.subjectId ?? "" }])));
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

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Teachers" title="Teacher management" action={isAdmin ? <Link href="/teachers/new" className="btn-primary">Add teacher</Link> : null} />

      <div className="flex justify-end">
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[13px] font-medium ${
            showInactive ? "bg-[#0071e3] border-[#0071e3] text-white shadow-[0_2px_10px_rgba(0,113,227,0.3)]" : "bg-white border-[rgba(0,0,0,0.08)] text-[#1d1d1f] hover:bg-[#f5f5f7]"
          }`}
        >
          <div className={`h-2 w-2 rounded-full ${showInactive ? "bg-white animate-pulse" : "bg-[#86868b]"}`} />
          {showInactive ? "Showing Inactive" : "Show Inactive Only"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
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
            ) : teachers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[#86868b]">No teachers found.</td>
              </tr>
            ) : (
              teachers.map((teacher) => (
                <tr key={teacher.id} className="table-row">
                  <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{teacher.fullName}</td>
                  <td className="px-5 py-4 text-[#6e6e73]">{teacher.email || "-"}</td>
                  <td className="px-5 py-4 text-[#6e6e73]">{teacher.phone || "-"}</td>
                  <td className="px-5 py-4 text-[#6e6e73]">
                    {(teacher.classTeacherFor ?? []).length ? teacher.classTeacherFor?.map((item) => `${item.name}-${item.section}`).join(", ") : "None"}
                  </td>
                  <td className="px-5 py-4 text-[#6e6e73]">
                    {(teacher.periodAssignments ?? []).filter((period) => period.classId).length}/8 assigned
                  </td>
                  <td className="px-5 py-4"><StatusPill label={teacher.status} tone={teacher.status === "ACTIVE" ? "good" : "warn"} /></td>
                  <td className="px-5 py-4 text-right">
                    {isAdmin ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openAssignments(teacher.id)} className="inline-flex items-center rounded-lg bg-[#0071e3]/10 px-3 py-1.5 text-[11px] font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white transition-colors">
                          Manage
                        </button>
                        {teacher.status === "ACTIVE" ? (
                          <button onClick={() => handleDelete(teacher.id)} className="inline-flex items-center rounded-lg bg-[rgba(255,59,48,0.1)] px-3 py-1.5 text-[11px] font-bold text-[#d70015] hover:bg-[#ff3b30] hover:text-white transition-colors">
                            Deactivate
                          </button>
                        ) : (
                          <button onClick={() => handleActivate(teacher.id)} className="inline-flex items-center rounded-lg bg-[rgba(52,199,89,0.1)] px-3 py-1.5 text-[11px] font-bold text-[#248a3d] hover:bg-[#34c759] hover:text-white transition-colors">
                            Activate
                          </button>
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {assignmentContext && typeof window !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Manage classes and subjects</h2>
                <p className="mt-0.5 text-[13px] text-[#86868b]">{assignmentContext.teacher.fullName} gets 8 periods. Leave a row empty for free period.</p>
              </div>
              <button className="rounded-full px-3 py-1 text-[13px] font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]" onClick={() => setAssignmentContext(null)} type="button">Close</button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-5">
              {assignmentError ? <div className="mb-4 rounded-xl bg-[#ff3b30]/10 p-3 text-[13px] font-medium text-[#d70015]">{assignmentError}</div> : null}
              {assignmentLoading ? (
                <p className="py-10 text-center text-[13px] text-[#86868b]">Loading assignments...</p>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: 8 }, (_, index) => {
                    const periodNumber = index + 1;
                    const draft = assignmentDraft[periodNumber] ?? { classId: "", subjectId: "" };
                    const selectedClass = assignmentContext.classes.find((item) => item.id === draft.classId);
                    const subjects = selectedClass?.subjects ?? [];

                    return (
                      <div className="grid gap-3 rounded-xl border border-[rgba(0,0,0,0.06)] p-3 sm:grid-cols-[80px_1fr_1fr]" key={periodNumber}>
                        <div className="flex items-center text-[13px] font-semibold text-[#1d1d1f]">Period {periodNumber}</div>
                        <select
                          className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[#0071e3]"
                          value={draft.classId}
                          onChange={(event) =>
                            setAssignmentDraft((current) => ({
                              ...current,
                              [periodNumber]: { classId: event.target.value, subjectId: "" }
                            }))
                          }
                        >
                          <option value="">Free period</option>
                          {assignmentContext.classes.map((classRecord) => (
                            <option key={classRecord.id} value={classRecord.id}>Class {classLabel(classRecord)}</option>
                          ))}
                        </select>
                        <select
                          className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[#0071e3]"
                          disabled={!draft.classId}
                          value={draft.subjectId}
                          onChange={(event) =>
                            setAssignmentDraft((current) => ({
                              ...current,
                              [periodNumber]: { ...draft, subjectId: event.target.value }
                            }))
                          }
                        >
                          <option value="">Select subject</option>
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[rgba(0,0,0,0.06)] bg-[#f5f5f7]/60 px-5 py-4">
              <button className="rounded-xl px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] hover:bg-white" onClick={() => setAssignmentContext(null)} type="button">Cancel</button>
              <button className="rounded-xl bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={assignmentSaving} onClick={saveAssignments} type="button">
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
