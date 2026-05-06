"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { KpiCardSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";

type TeacherClass = {
  id: string;
  name: string;
  section: string;
  academicYear: string;
  classTeacher?: { id: string; fullName: string; phone: string } | null;
  subjects?: { id: string; name: string; teacherId: string | null }[];
  _count?: { students: number };
};

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiFetch<TeacherClass[]>("/classes")
      .then((rows) => {
        if (active) setClasses(rows);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load assigned classes");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Teacher workspace" title="My classes" />

      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <KpiCardSkeleton key={index} />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-12 text-center text-[13px] text-[#86868b] shadow-apple-sm">
          No classes are assigned to this teacher yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((classRecord) => (
            <Link className="glass-card-interactive block p-5 hover:no-underline" href={`/classes/${classRecord.id}`} key={classRecord.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Class</p>
                  <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[#1d1d1f]">
                    {classRecord.name}-{classRecord.section}
                  </h2>
                </div>
                <StatusPill label={`${classRecord._count?.students ?? 0} students`} tone="good" />
              </div>

              <div className="mt-5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Assigned subjects</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(classRecord.subjects ?? []).length === 0 ? (
                    <span className="rounded-full bg-[#ff9500]/10 px-3 py-1 text-[12px] font-semibold text-[#c93400]">Subjects pending</span>
                  ) : (
                    classRecord.subjects?.map((subject) => (
                      <span className="rounded-full bg-[#0071e3]/10 px-3 py-1 text-[12px] font-semibold text-[#0071e3]" key={subject.id}>
                        {subject.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl bg-[rgba(0,0,0,0.02)] px-4 py-3 text-[13px]">
                <span className="font-medium text-[#6e6e73]">Academic year</span>
                <span className="font-semibold text-[#1d1d1f]">{classRecord.academicYear}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
