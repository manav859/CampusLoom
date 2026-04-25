"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";

export default function NewTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.role !== "ADMIN" && u.role !== "PRINCIPAL") {
          router.replace("/teachers");
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        email: formData.email || undefined,
      };
      
      await apiFetch("/users/teachers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push("/teachers");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to add teacher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader eyebrow="Teachers" title="Add new teacher" />
      
      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Full Name</label>
          <input
            required
            minLength={2}
            className="glass-input w-full"
            placeholder="e.g. John Doe"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Email Address</label>
            <input
              type="email"
              className="glass-input w-full"
              placeholder="e.g. teacher@school.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Phone Number</label>
            <input
              required
              minLength={10}
              className="glass-input w-full"
              placeholder="e.g. 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Initial Password</label>
          <input
            required
            minLength={6}
            type="password"
            className="glass-input w-full"
            placeholder="Set a default password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
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
            {loading ? "Adding..." : "Add Teacher"}
          </button>
        </div>
      </form>
    </div>
  );
}
