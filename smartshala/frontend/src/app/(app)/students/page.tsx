"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { apiFetch } from "@/lib/api";

type StudentData = {
  id: string;
  admissionNumber: string;
  fullName: string;
  class: { name: string; section: string };
  isActive: boolean;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; section: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  // Initial load
  useEffect(() => {
    apiFetch<{ id: string; name: string; section: string }[]>("/classes")
      .then((data) => setClasses(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Dedicated data fetching effect for state changes
  useEffect(() => {
    const st = setTimeout(() => {
      setLoadingList(true);
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      params.set("page", page.toString());
      if (search) params.set("search", search);
      if (classId) params.set("classId", classId);

      apiFetch<{ items: StudentData[]; total: number }>(`/students?${params.toString()}`)
        .then((data) => {
          setStudents(data?.items || []);
          setTotal(data?.total || 0);
        })
        .catch(console.error)
        .finally(() => setLoadingList(false));
    }, 300); // debounce input typing
    return () => clearTimeout(st);
  }, [search, classId, page]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Students" title="Student directory" action={<button className="btn-primary">Add student</button>} />
      
      <div className="flex flex-col gap-3 sm:flex-row">
        <input 
          className="glass-input sm:w-80" 
          placeholder="Search name, admission no, phone"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select 
          className="glass-input sm:w-48"
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setPage(1); }}
        >
          <option value="">All classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}-{cls.section}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <div className="relative">
          {loadingList && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10 transition-opacity" />
          )}
          <table className="w-full text-left text-[13px]">
            <thead className="table-head">
              <tr>
                {["Admission", "Name", "Class", "Status", ""].map((head) => (
                  <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#86868b]">
                    Loading students…
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#86868b]">
                    No students found.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="table-row">
                    <td className="px-5 py-4 text-[#6e6e73]">{student.admissionNumber}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{student.fullName}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{student.class ? `${student.class.name}-${student.class.section}` : "Unassigned"}</td>
                    <td className="px-5 py-4">
                      <StatusPill label={student.isActive ? "Active" : "Inactive"} tone={student.isActive ? "good" : "neutral"} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link className="text-[13px] font-medium text-[#0071e3] hover:text-[#0077ed] transition-colors" href={`/students/${student.id}`}>
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {total > limit && (
          <div className="flex items-center justify-between border-t border-[rgba(0,0,0,0.06)] px-5 py-3">
            <div className="text-[13px] text-[#86868b]">
              Showing <span className="font-medium text-[#1d1d1f]">{(page - 1) * limit + 1}</span> to <span className="font-medium text-[#1d1d1f]">{Math.min(page * limit, total)}</span> of <span className="font-medium text-[#1d1d1f]">{total}</span>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-full border border-[rgba(0,0,0,0.06)] bg-white px-4 py-1.5 text-[13px] font-medium text-[#0071e3] hover:bg-[#f5f5f7] transition-colors disabled:opacity-40 disabled:text-[#86868b]"
              >
                Previous
              </button>
              <button 
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="rounded-full border border-[rgba(0,0,0,0.06)] bg-white px-4 py-1.5 text-[13px] font-medium text-[#0071e3] hover:bg-[#f5f5f7] transition-colors disabled:opacity-40 disabled:text-[#86868b]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
