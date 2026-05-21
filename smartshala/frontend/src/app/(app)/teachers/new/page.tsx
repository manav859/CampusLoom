"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormSection, openInvalidFormSection } from "@/components/ui/FormSection";
import { SideModal } from "@/components/ui/SideModal";
import { apiFetch } from "@/lib/api";

export default function NewTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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
    setErrorMsg("");
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
      setErrorMsg(error?.message || "Failed to add teacher.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideModal eyebrow="Teachers" onClose={() => router.back()} title="Add new teacher">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.2)] text-[#d70015] text-[13px] font-medium flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      <form onInvalid={openInvalidFormSection} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <FormSection title="Basic Details" defaultOpen>
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
          </FormSection>

          <FormSection title="Contact Details">
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
          </FormSection>

          <FormSection title="Login Details">
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
          </FormSection>
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
            className="btn-primary gap-2 px-8 py-2.5 rounded-xl disabled:opacity-50"
          >
            {loading ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {loading ? "Adding..." : "Add Teacher"}
          </button>
        </div>
      </form>
    </SideModal>
  );
}
