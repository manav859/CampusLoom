"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { KpiCardSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { cachedFetch } from "@/lib/prefetchCache";

type ClassData = {
  id: string;
  name: string;
  section: string;
  academicYear: string;
  classTeacher?: { id: string; fullName: string; phone: string } | null;
  _count?: { students: number };
};

function classTone(className: string) {
  const grade = Number.parseInt(className, 10);
  if (!Number.isFinite(grade)) return { border: "border-[#8C96A3]", accent: "text-[#5A6573]", iconBg: "bg-[#F2F5F8]" };
  if (grade <= 5) return { border: "border-[#0F8A4A]", accent: "text-[#0F8A4A]", iconBg: "bg-[#E1F5EA]" };
  if (grade <= 8) return { border: "border-[#2456E6]", accent: "text-[#2456E6]", iconBg: "bg-[#EEF3FF]" };
  return { border: "border-[#B95A00]", accent: "text-[#B95A00]", iconBg: "bg-[#FFF2DC]" };
}

function ClassCard({ cls, isAdmin, onDelete }: { cls: ClassData; isAdmin: boolean; onDelete: (event: React.MouseEvent, id: string) => void }) {
  const studentCount = cls._count?.students ?? 0;
  const tone = classTone(cls.name);

  return (
    <article className={`rounded-[6px] border bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.06),0_8px_22px_-18px_rgba(15,20,25,0.45)] transition-colors duration-200 hover:border-[#8C96A3] sm:p-5 ${tone.border}`}>
      <div className="flex items-start gap-4">
        <Link href={`/classes/${cls.id}`} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] sm:h-14 sm:w-14 ${tone.iconBg}`}>
          <svg className={`h-6 w-6 ${tone.accent}`} fill="none" viewBox="0 0 32 32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" aria-hidden="true">
            <path d="M8 6h12a4 4 0 0 1 4 4v16H12a4 4 0 0 0-4-4V6Z" />
            <path d="M8 22V10a4 4 0 0 1 4-4" />
            <path d="M13 13h6M13 18h5" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/classes/${cls.id}`} className="min-w-0">
              <span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#52687D]">{cls.academicYear}</span>
              <span className="mt-0.5 block truncate text-[26px] font-semibold leading-8 text-[#0F2233] [font-variant-numeric:tabular-nums] sm:text-[24px]">
                {cls.name}-{cls.section}
              </span>
            </Link>
            {isAdmin ? (
              <button
                aria-label={`Delete class ${cls.name}-${cls.section}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#F2C7CB] bg-[#FFF7F8] text-[#C8242C] transition-colors hover:bg-[#FCE3E5]"
                onClick={(event) => onDelete(event, cls.id)}
                type="button"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[12px] font-medium text-[#52687D]">Students</p>
              <p className="mt-0.5 text-[18px] font-semibold text-[#0F2233]">{studentCount}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#52687D]">Teacher</p>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-[#0F2233]">{cls.classTeacher?.fullName || "Unassigned"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5">
        <Link href={`/classes/${cls.id}`} className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-[6px] bg-[#2456E6] px-4 text-[13px] font-semibold text-white">
          Roster
        </Link>
        <Link href={`/attendance?classId=${cls.id}`} className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-[6px] border border-[#C9D3DE] bg-white px-4 text-[13px] font-semibold text-[#2A3340]">
          Attendance
        </Link>
        <Link href={`/teacher/communication?classId=${cls.id}`} className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-[6px] border border-[#C9D3DE] bg-white px-4 text-[13px] font-semibold text-[#2A3340]">
          Notice
        </Link>
      </div>
    </article>
  );
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setIsAdmin(u.role === "ADMIN" || u.role === "PRINCIPAL");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    cachedFetch(`classes:list:${isAdmin ? "ADMIN" : "SCOPED"}`, () => apiFetch<ClassData[]>("/classes"))
      .then((data) => setClasses(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; id: string | null; error?: string }>({ isOpen: false, id: null });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setConfirmDialog({ isOpen: true, id });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog.id) return;
    try {
      await apiFetch(`/classes/${confirmDialog.id}`, { method: "DELETE" });
      setClasses((prev) => prev.filter((c) => c.id !== confirmDialog.id));
      setConfirmDialog({ isOpen: false, id: null });
    } catch (err: any) {
      setConfirmDialog((prev) => ({ ...prev, error: err?.message || "Failed to delete class" }));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6E7885]">Classes</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#0F1419]">Classes</h1>
        </div>
        {isAdmin ? (
          <Link href="/classes/new" className="btn-primary min-h-[44px] w-full justify-center sm:w-auto">
            Create class
          </Link>
        ) : null}
      </div>
      
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-[#DCE1E8] bg-white px-5 py-10 text-center text-[13px] font-medium text-[#6E7885]">
          No classes found.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard cls={cls} isAdmin={isAdmin} key={cls.id} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ── Custom Confirm Modal ── */}
      {confirmDialog.isOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ff3b30]/10 text-[#ff3b30] mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f]">
                Delete Class
              </h3>
              <p className="mt-2 text-[13px] text-[#86868b]">
                Are you sure you want to delete this class? This action cannot be undone.
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
                onClick={() => setConfirmDialog({ isOpen: false, id: null })} 
                className="flex-1 py-3 text-[14px] font-medium text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors border-r border-[rgba(0,0,0,0.06)]"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete} 
                className="flex-1 py-3 text-[14px] font-semibold text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
