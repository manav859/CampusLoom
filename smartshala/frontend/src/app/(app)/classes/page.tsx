"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
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
      <PageHeader eyebrow="Classes" title="Classes and assignments" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Create class</button>} />
      
      {loading ? (
        <div className="rounded-lg border border-line bg-panel p-8 text-center text-sm text-neutral-500">
          Loading classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-8 text-center text-sm text-neutral-500">
          No classes found.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <div key={cls.id} className="rounded-lg border border-line bg-panel p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{cls.name}-{cls.section}</h2>
                <StatusPill label="Active" tone="good" />
              </div>
              <p className="mt-3 text-sm text-neutral-600">Class teacher: {cls.classTeacher?.fullName || "Unassigned"}</p>
              <p className="mt-1 text-sm text-neutral-600">{cls._count?.students || 0} active students</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
