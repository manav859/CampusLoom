"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
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
      <PageHeader eyebrow="Teachers" title="Teacher management" action={<button className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-white">Add teacher</button>} />
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              {["Name", "Email", "Phone", "Status"].map((head) => (
                <th className="px-3 py-3 font-semibold" key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">
                  Loading teachers...
                </td>
              </tr>
            ) : teachers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">
                  No teachers found.
                </td>
              </tr>
            ) : (
              teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td className="px-3 py-3 font-medium text-ink">{teacher.fullName}</td>
                  <td className="px-3 py-3 text-neutral-500">{teacher.email || "-"}</td>
                  <td className="px-3 py-3 text-neutral-500">{teacher.phone || "-"}</td>
                  <td className="px-3 py-3">
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
