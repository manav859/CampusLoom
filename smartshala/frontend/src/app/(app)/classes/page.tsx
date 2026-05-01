"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";

type ClassData = {
  id: string;
  name: string;
  section: string;
  academicYear: string;
  classTeacher?: { id: string; fullName: string; phone: string } | null;
  _count?: { students: number };
};

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
    // API endpoint /classes implicitly exists as shown by your backend routes
    apiFetch<ClassData[]>("/classes")
      .then((data) => setClasses(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
    <div className="space-y-5">
      <PageHeader eyebrow="Classes" title="Classes and assignments" action={isAdmin ? <Link href="/classes/new" className="btn-primary">Create class</Link> : null} />
      
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] p-12 text-center text-[13px] text-[#86868b] shadow-apple-sm">
          No classes found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Link key={cls.id} href={`/classes/${cls.id}`} className="glass-card-interactive p-5 block hover:no-underline">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{cls.name}-{cls.section}</h2>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={(e) => handleDelete(e, cls.id)} className="text-[#ff3b30] hover:text-[#d70015] p-1 rounded-lg transition-colors hover:bg-[rgba(255,59,48,0.1)]">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                  <StatusPill label="Active" tone="good" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-[13px]">
                  <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M6 19a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-[#6e6e73]">{cls.classTeacher?.fullName || "Unassigned"}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <svg className="h-4 w-4 text-[#86868b]" fill="none" viewBox="0 0 24 24">
                    <path d="M8 11a3 3 0 100-6 3 3 0 000 6zM17 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3.5 19a4.5 4.5 0 019 0M13 19a4 4 0 018 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-[#6e6e73]">{cls._count?.students || 0} students</span>
                </div>
              </div>
            </Link>
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
