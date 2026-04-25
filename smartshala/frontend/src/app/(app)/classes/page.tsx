"use client";

import { useEffect, useState } from "react";
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this class? This cannot be undone.")) return;
    try {
      await apiFetch(`/classes/${id}`, { method: "DELETE" });
      setClasses((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete class");
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
    </div>
  );
}
