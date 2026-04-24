"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    // API endpoint /classes implicitly exists as shown by your backend routes
    apiFetch<ClassData[]>("/classes")
      .then((data) => setClasses(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Classes" title="Classes and assignments" action={<button className="btn-primary">Create class</button>} />
      
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
            <div key={cls.id} className="glass-card-interactive p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{cls.name}-{cls.section}</h2>
                <StatusPill label="Active" tone="good" />
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
