"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton, TableRowSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";

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

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<ClassDetail>(`/classes/${id}`),
      apiFetch<Student[]>(`/classes/${id}/students`)
    ]).then(([cls, stds]) => {
      setClassData(cls);
      setStudents(stds || []);
    }).catch((err) => {
      console.error(err);
      // router.push("/classes");
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 bg-[#f5f5f7] animate-pulse rounded-xl" />
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow={`Class ${classData.name}-${classData.section}`} title={`${classData.name} — Section ${classData.section}`} />
        <button className="btn-secondary px-5 py-2" onClick={() => router.back()}>Back</button>
      </div>

      {/* Class KPIs */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="glass-card p-5 space-y-1">
          <p className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Class Teacher</p>
          <p className="text-[19px] font-semibold text-[#1d1d1f]">{classData.classTeacher?.fullName || "Unassigned"}</p>
          <p className="text-[13px] text-[#6e6e73]">{classData.classTeacher?.phone || "No contact"}</p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <p className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Total Students</p>
          <p className="text-[19px] font-semibold text-[#1d1d1f]">{classData._count.students} Students</p>
          <p className="text-[13px] text-[#6e6e73]">Enrolled in {classData.academicYear}</p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <p className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Academic Year</p>
          <p className="text-[19px] font-semibold text-[#1d1d1f]">{classData.academicYear}</p>
          <StatusPill label="Current Session" tone="good" />
        </div>
      </div>

      {/* Student List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[17px] font-bold text-[#1d1d1f]">Student Roster</h3>
          <span className="text-[13px] text-[#86868b] font-medium">{students.length} students listed</span>
        </div>
        
        <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#fbfbfd] text-[#86868b] border-b border-[rgba(0,0,0,0.04)]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Roll #</th>
                <th className="px-5 py-3.5 font-semibold">Student Name</th>
                <th className="px-5 py-3.5 font-semibold">Admission #</th>
                <th className="px-5 py-3.5 font-semibold">Parent Contact</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#86868b]">
                    No students enrolled in this class.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-[#f5f5f7]/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-[#86868b]">{student.rollNumber || "—"}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{student.fullName}</td>
                    <td className="px-5 py-4 text-[#6e6e73] font-medium">{student.admissionNumber}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{student.parentPhone}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/students/${student.id}`} className="text-[#0071e3] font-semibold hover:underline">View Profile</Link>
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
