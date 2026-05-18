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
  const [currentTeacherId, setCurrentTeacherId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        setCurrentTeacherId(JSON.parse(storedUser).id ?? "");
      } catch {
        setCurrentTeacherId("");
      }
    }

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
          {classes.map((classRecord) => {
            const isMyClass = Boolean(currentTeacherId && classRecord.classTeacher?.id === currentTeacherId);

            return (
            <div className="glass-card-interactive block p-5" key={classRecord.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Class</p>
                  <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[#1d1d1f]">
                    {classRecord.name}-{classRecord.section}
                  </h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isMyClass ? <StatusPill label="My class" tone="good" /> : null}
                  <StatusPill label={`${classRecord._count?.students ?? 0} students`} tone="neutral" />
                </div>
              </div>

              <div className="mt-5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">Assigned subjects</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(classRecord.subjects ?? []).length === 0 ? (
                    <span className="rounded-full bg-[#ff9500]/10 px-3 py-1 text-[12px] font-semibold text-[#c93400]">Subjects pending</span>
                  ) : (
                    classRecord.subjects?.map((subject) => (
                      <span className="rounded-md bg-[#F1F3F6] px-2.5 py-1 text-[12px] font-semibold text-[#2A3340]" key={subject.id}>
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

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {isMyClass ? (
                  <Link className="rounded-lg bg-[#2456E6] px-3 py-2 text-center text-[12px] font-semibold text-white hover:bg-[#1B45BD]" href={`/attendance?classId=${classRecord.id}`}>
                    Mark attendance
                  </Link>
                ) : null}
                <Link className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-center text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href={`/teacher/homework?classId=${classRecord.id}`}>
                  Assign homework
                </Link>
                <Link className="rounded-lg border border-[#C2C9D4] bg-white px-3 py-2 text-center text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href={`/classes/${classRecord.id}`}>
                  View roster
                </Link>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
