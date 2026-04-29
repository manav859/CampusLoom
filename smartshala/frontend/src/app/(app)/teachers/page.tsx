"use client";

import { useEffect, useState } from "react";
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this teacher?")) return;
    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to deactivate teacher");
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm("Are you sure you want to activate this teacher?")) return;
    try {
      await apiFetch(`/users/${id}/activate`, { method: "PATCH" });
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to activate teacher");
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
    </div>
  );
}
