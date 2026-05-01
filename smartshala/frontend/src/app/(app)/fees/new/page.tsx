"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";

type ClassData = { id: string; name: string; section: string };

export default function NewFeeStructurePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [classes, setClasses] = useState<ClassData[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    academicYear: new Date().getFullYear().toString() + "-" + (new Date().getFullYear() + 1).toString().slice(-2),
    classId: "",
    frequency: "ANNUAL",
    totalAmount: "",
    dueDate: "",
  });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.role !== "ADMIN" && u.role !== "PRINCIPAL") {
          router.replace("/fees");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    apiFetch<ClassData[]>("/classes")
      .then((clsData) => setClasses(clsData || []))
      .catch(console.error);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const payload = {
        name: formData.name,
        academicYear: formData.academicYear,
        classId: formData.classId || undefined,
        frequency: formData.frequency,
        totalAmount: Number(formData.totalAmount),
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
      };

      await apiFetch("/fees/structures", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push("/fees");
      router.refresh();
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to create fee structure.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader eyebrow="Fees" title="Create Fee Structure" />
      
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.2)] text-[#d70015] text-[13px] font-medium flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Structure Name</label>
          <input
            required
            className="glass-input w-full"
            placeholder="e.g. Annual Tuition Fee 2024-25"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
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
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Class (Optional)</label>
            <select
              className="glass-input w-full"
              value={formData.classId}
              onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name} — Section {cls.section}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Total Amount (₹)</label>
            <input
              required
              type="number"
              min="0"
              className="glass-input w-full"
              placeholder="e.g. 50000"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Frequency</label>
            <select
              required
              className="glass-input w-full"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
            >
              <option value="ANNUAL">Annual</option>
              <option value="BIANNUAL">Biannual</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Due Date</label>
            <input
              required
              type="date"
              className="glass-input w-full"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
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
            {loading ? "Creating..." : "Create Structure"}
          </button>
        </div>
      </form>
    </div>
  );
}
