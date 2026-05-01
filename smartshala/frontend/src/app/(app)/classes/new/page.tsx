"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";

type Teacher = { id: string; fullName: string };

export default function NewClassPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    section: "",
    academicYear: new Date().getFullYear().toString() + "-" + (new Date().getFullYear() + 1).toString().slice(-2),
    classTeacherId: "",
  });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.role !== "ADMIN" && u.role !== "PRINCIPAL") {
          router.replace("/classes");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    apiFetch<{ items: Teacher[] }>("/users/teachers?limit=100")
      .then((data) => setTeachers(data?.items || []))
      .catch(console.error);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const payload = { ...formData };
    if (!payload.classTeacherId) delete payload.classTeacherId;
    try {
      await apiFetch("/classes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push("/classes");
      router.refresh();
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to create class.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader eyebrow="Classes" title="Create new class" />
      
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.2)] text-[#d70015] text-[13px] font-medium flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Class Name</label>
            <input
              required
              className="glass-input w-full"
              placeholder="e.g. 10, 11, 12"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Section</label>
            <input
              required
              className="glass-input w-full"
              placeholder="e.g. A, B, C"
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Academic Year</label>
          <input
            required
            className="glass-input w-full"
            placeholder="e.g. 2024-25"
            value={formData.academicYear}
            onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Class Teacher (Optional)</label>
          <select
            className="glass-input w-full"
            value={formData.classTeacherId}
            onChange={(e) => setFormData({ ...formData, classTeacherId: e.target.value })}
          >
            <option value="">Select a teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.fullName}</option>
            ))}
          </select>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-[14px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-8 py-2.5 rounded-xl disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Class"}
          </button>
        </div>
      </form>
    </div>
  );
}
