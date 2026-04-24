"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    // Backend allows fetching teachers via /users/teachers (must match valid route in users module)
    apiFetch<{ items: TeacherData[] }>("/users/teachers?limit=100")
      .then((data) => setTeachers(data?.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Teachers" title="Teacher management" action={<button className="btn-primary">Add teacher</button>} />
      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <table className="w-full text-left text-[13px]">
          <thead className="table-head">
            <tr>
              {["Name", "Email", "Phone", "Status"].map((head) => (
                <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
