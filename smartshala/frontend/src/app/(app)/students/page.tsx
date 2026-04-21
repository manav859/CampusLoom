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
      <PageHeader eyebrow="Students" title="Student directory" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Add student</button>} />
      
      <div className="flex flex-col gap-3 sm:flex-row">
        <input 
          className="rounded-lg border border-line bg-panel px-3 py-2 sm:w-80" 
          placeholder="Search name, admission no, phone"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select 
          className="rounded-lg border border-line bg-panel px-3 py-2"
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setPage(1); }}
        >
          <option value="">All classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}-{cls.section}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm relative">
          {loadingList && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 transition-opacity" />
          )}
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              {["Admission", "Name", "Class", "Status", ""].map((head) => (
                <th className="px-3 py-3 font-semibold" key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && students.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  Loading students...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  No students found.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id}>
                  <td className="px-3 py-3 text-neutral-600">{student.admissionNumber}</td>
                  <td className="px-3 py-3 font-medium text-ink">{student.fullName}</td>
                  <td className="px-3 py-3">{student.class ? `${student.class.name}-${student.class.section}` : "Unassigned"}</td>
                  <td className="px-3 py-3">
                    <StatusPill label={student.isActive ? "Active" : "Inactive"} tone={student.isActive ? "good" : "neutral"} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link className="font-medium text-action hover:underline" href={`/students/${student.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {total > limit && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-6">
            <div className="text-sm text-neutral-600">
              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> results
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button 
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
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
