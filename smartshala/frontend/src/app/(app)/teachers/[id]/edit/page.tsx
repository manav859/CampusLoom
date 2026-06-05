"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";
import { invalidateCache } from "@/lib/prefetchCache";

type TeacherData = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
};

async function findTeacher(id: string) {
  return apiFetch<TeacherData>(`/users/teachers/${id}`);
}

export default function EditTeacherPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    status: "ACTIVE"
  });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.role !== "ADMIN" && user.role !== "PRINCIPAL") {
          router.replace("/teachers");
          return;
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (!id) {
      setErrorMsg("Teacher not found.");
      setLoading(false);
      return;
    }

    let active = true;
    findTeacher(id)
      .then((teacher) => {
        if (!active) return;
        if (!teacher) {
          setErrorMsg("Teacher not found.");
          return;
        }
        setFormData({
          fullName: teacher.fullName,
          email: teacher.email ?? "",
          phone: teacher.phone,
          status: teacher.status
        });
      })
      .catch((error) => {
        if (active) setErrorMsg(error instanceof Error ? error.message : "Unable to load teacher");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrorMsg("");
    try {
      await apiFetch(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim(),
          status: formData.status
        })
      });
      invalidateCache("teachers:list");
      invalidateCache("teachers:list:inactive");
      router.push("/teachers");
      router.refresh();
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to update teacher.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl bg-white p-6 text-[13px] font-medium text-[#86868b] shadow-apple-sm">Loading teacher...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Teachers" title="Edit Teacher Details" />

      {errorMsg ? (
        <div className="rounded-xl border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.1)] p-4 text-[13px] font-medium text-[#d70015]">
          {errorMsg}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="glass-card space-y-5 p-8">
        <label className="block space-y-1.5">
          <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Full Name</span>
          <input
            required
            minLength={2}
            className="glass-input w-full"
            placeholder="e.g. John Doe"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Email Address</span>
            <input
              className="glass-input w-full"
              placeholder="teacher@school.com"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Phone Number</span>
            <input
              required
              minLength={10}
              className="glass-input w-full"
              placeholder="9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Status</span>
          <select className="glass-input w-full" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]" onClick={() => router.back()} type="button">
            Cancel
          </button>
          <button className="btn-primary gap-2 rounded-xl px-8 py-2.5 disabled:opacity-50" disabled={saving || Boolean(errorMsg && errorMsg === "Teacher not found.")} type="submit">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
