"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";

type TeacherData = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  status: string;
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

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
    setLoading(true);
    // Backend allows fetching teachers via /users/teachers (must match valid route in users module)
    apiFetch<{ items: TeacherData[] }>(`/users/teachers?limit=100${showInactive ? "&showInactive=true" : ""}`)
      .then((data) => setTeachers(data?.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [showInactive]);

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: 'activate' | 'deactivate'; teacherId: string | null; error?: string }>({ isOpen: false, action: 'deactivate', teacherId: null });

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, action: 'deactivate', teacherId: id });
  };

  const handleActivate = (id: string) => {
    setConfirmDialog({ isOpen: true, action: 'activate', teacherId: id });
  };

  const handleConfirmAction = async () => {
    const { teacherId, action } = confirmDialog;
    if (!teacherId) return;

    try {
      if (action === 'deactivate') {
        await apiFetch(`/users/${teacherId}`, { method: "DELETE" });
      } else {
        await apiFetch(`/users/${teacherId}/activate`, { method: "PATCH" });
      }
      setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
      setConfirmDialog({ isOpen: false, action: 'deactivate', teacherId: null });
    } catch (e: any) {
      setConfirmDialog((prev) => ({ ...prev, error: e?.message || `Failed to ${action} teacher` }));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Teachers" title="Teacher management" action={isAdmin ? <Link href="/teachers/new" className="btn-primary">Add teacher</Link> : null} />
      
      <div className="flex justify-end">
        <button
          onClick={() => setShowInactive(!showInactive)}
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
      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <table className="w-full text-left text-[13px]">
          <thead className="table-head">
            <tr>
              {["Name", "Email", "Phone", "Status", ""].map((head, i) => (
                <th className="px-5 py-3.5 font-semibold" key={i}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)
            ) : teachers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-[#86868b]">
                  No teachers found.
                </td>
              </tr>
            ) : (
              teachers.map((teacher) => (
                <tr key={teacher.id} className="table-row">
                  <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{teacher.fullName}</td>
                  <td className="px-5 py-4 text-[#6e6e73]">{teacher.email || "—"}</td>
                  <td className="px-5 py-4 text-[#6e6e73]">{teacher.phone || "—"}</td>
                  <td className="px-5 py-4">
                    <StatusPill label={teacher.status} tone={teacher.status === "ACTIVE" ? "good" : "warn"} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {isAdmin && (
                      teacher.status === "ACTIVE" ? (
                        <button onClick={() => handleDelete(teacher.id)} className="inline-flex items-center rounded-lg bg-[rgba(255,59,48,0.1)] px-3 py-1.5 text-[11px] font-bold text-[#d70015] hover:bg-[#ff3b30] hover:text-white transition-colors">
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => handleActivate(teacher.id)} className="inline-flex items-center rounded-lg bg-[rgba(52,199,89,0.1)] px-3 py-1.5 text-[11px] font-bold text-[#248a3d] hover:bg-[#34c759] hover:text-white transition-colors">
                          Activate
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
                {confirmDialog.action === 'deactivate' ? 'Deactivate Teacher' : 'Activate Teacher'}
              </h3>
              <p className="mt-2 text-[13px] text-[#86868b]">
                Are you sure you want to {confirmDialog.action} this teacher? You can reverse this action later.
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
                onClick={() => setConfirmDialog({ isOpen: false, action: 'deactivate', teacherId: null })} 
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
    </div>
  );
}
