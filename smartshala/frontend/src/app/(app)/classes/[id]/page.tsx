"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { apiFetch, classesApi, type ClassStats } from "@/lib/api";
import { cachedFetch } from "@/lib/prefetchCache";

type ClassDetail = {
  id: string;
  name: string;
  section: string;
  academicYear: string;
  classTeacher?: { fullName: string; phone: string; email: string } | null;
  _count: { students: number };
};

type Student = {
  id: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: number | null;
  parentPhone: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      cachedFetch(`class:${id}`, () => apiFetch<ClassDetail>(`/classes/${id}`)),
      cachedFetch(`class:${id}:students`, () => apiFetch<Student[]>(`/classes/${id}/students`)),
      cachedFetch(`class:${id}:stats`, () => classesApi.stats(String(id)))
    ]).then(([cls, stds, classStats]) => {
      setClassData(cls);
      setStudents(stds || []);
      setStats(classStats);
    }).catch((err) => {
      console.error(err);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded-xl bg-[#f5f5f7]" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  if (!classData) return <div>Class not found</div>;

  const rosterCount = students.length;
  const apiCount = classData._count.students;
  const countMismatch = apiCount !== rosterCount;
  const sortedRolls = students
    .map((student) => student.rollNumber)
    .filter((roll): roll is number => typeof roll === "number")
    .sort((a, b) => a - b);
  const rollNumbersStartAtOne = sortedRolls.length === 0 || sortedRolls.every((roll, index) => roll === index + 1);
  const statCards = [
    { label: "Class Attendance", value: stats?.attendancePercent === null || !stats ? "No data" : `${stats.attendancePercent}%`, helper: `Last ${stats?.attendanceWindowDays ?? 30} days` },
    { label: "Marks Average", value: stats?.marksAveragePercent === null || !stats ? "No data" : `${stats.marksAveragePercent}%`, helper: "All recorded exams" },
    { label: "Fee Collection", value: stats?.feeCollectionPercent === null || !stats ? "No data" : `${stats.feeCollectionPercent}%`, helper: "Collected vs assigned" }
  ];

  return (
    <div className="space-y-6 pb-12 print:bg-white">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow={`Class ${classData.name}-${classData.section}`} title={`${classData.name} - Section ${classData.section}`} />
        <div className="flex gap-2 print:hidden">
          <button className="btn-secondary px-5 py-2" onClick={() => window.print()} type="button">Print Class List</button>
          <button className="btn-secondary px-5 py-2" onClick={() => router.back()} type="button">Back</button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="glass-card space-y-1 p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#86868b]">Class Teacher</p>
          <p className="text-[19px] font-semibold text-[#1d1d1f]">{classData.classTeacher?.fullName || "Unassigned"}</p>
          <p className="text-[13px] text-[#6e6e73]">{classData.classTeacher?.phone || "No contact"}</p>
        </div>
        <div className="glass-card space-y-1 p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#86868b]">Total Students</p>
          <p className="text-[19px] font-semibold text-[#1d1d1f]">{rosterCount} Students</p>
          <p className="text-[13px] text-[#6e6e73]">{countMismatch ? `Roster synced from ${apiCount}` : `Enrolled in ${classData.academicYear}`}</p>
        </div>
        <div className="glass-card space-y-1 p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#86868b]">Academic Year</p>
          <p className="text-[19px] font-semibold text-[#1d1d1f]">{classData.academicYear}</p>
          <StatusPill label="Current Session" tone="good" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div className="kpi-metric-card p-5" key={card.label}>
            <p className="kpi-metric-label">{card.label}</p>
            <p className="kpi-metric-value">{card.value}</p>
            <p className="mt-1 text-[12px] font-medium text-[#6e6e73]">{card.helper}</p>
          </div>
        ))}
      </div>

      {countMismatch || !rollNumbersStartAtOne ? (
        <div className="rounded-2xl border border-[#FFF2DC] bg-[#FFF8EA] px-4 py-3 text-[13px] font-medium text-[#8A4B00] print:hidden">
          {countMismatch ? `Roster header now uses the listed count (${rosterCount}) instead of stale count (${apiCount}). ` : ""}
          {!rollNumbersStartAtOne ? "Roll-number gaps detected; roster order is normalized as 1..N while assigned roll numbers remain visible." : ""}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[17px] font-bold text-[#1d1d1f]">Student Roster</h3>
          <span className="text-[13px] font-medium text-[#86868b]">{students.length} students listed</span>
        </div>

        <div className="overflow-visible rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <table className="w-full text-left text-[13px] print:text-[11px]">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Photo</th>
                <th className="px-5 py-3.5 font-semibold">Roster #</th>
                <th className="px-5 py-3.5 font-semibold">Assigned Roll</th>
                <th className="px-5 py-3.5 font-semibold">Student Name</th>
                <th className="px-5 py-3.5 font-semibold">Admission #</th>
                <th className="px-5 py-3.5 font-semibold">Parent Contact</th>
                <th className="px-5 py-3.5 text-right font-semibold print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {students.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-[#86868b]" colSpan={7}>
                    No students enrolled in this class.
                  </td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr className="transition-colors hover:bg-[#f5f5f7]/50" key={student.id}>
                    <td className="px-5 py-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE1E8] bg-[#F7F8FB] text-[11px] font-bold text-[#5A6573]">
                        {initials(student.fullName)}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold tabular-nums text-[#1d1d1f]">{index + 1}</td>
                    <td className="px-5 py-4 font-medium tabular-nums text-[#86868b]">{student.rollNumber || "-"}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{student.fullName}</td>
                    <td className="px-5 py-4 type-code text-[#6e6e73]">{student.admissionNumber}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{student.parentPhone}</td>
                    <td className="px-5 py-4 text-right print:hidden">
                      <details className="relative inline-block">
                        <summary className="list-none rounded-lg border border-[#DCE1E8] px-3 py-1.5 text-[12px] font-semibold text-[#2456E6] hover:bg-[#F7F8FB]">Actions</summary>
                        <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-xl border border-[#DCE1E8] bg-white py-1 text-left shadow-apple">
                          <Link className="block px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href={`/students/${student.id}`}>View</Link>
                          <Link className="block px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href={`/teacher/communication?studentId=${student.id}&classId=${classData.id}`}>Message</Link>
                          <Link className="block px-3 py-2 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" href={`/attendance?classId=${classData.id}`}>Mark attendance</Link>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
