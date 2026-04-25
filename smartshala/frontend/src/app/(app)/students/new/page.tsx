"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";

type ClassData = { id: string; name: string; section: string };
type FeeStructure = { id: string; name: string; totalAmount: number; academicYear: string };

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  
  const [formData, setFormData] = useState({
    fullName: "",
    rollNumber: "",
    dateOfBirth: "",
    gender: "",
    parentName: "",
    parentPhone: "",
    alternatePhone: "",
    address: "",
    classId: "",
    feeStructureId: "",
  });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.role !== "ADMIN" && u.role !== "PRINCIPAL") {
          router.replace("/students");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Load classes and fee structures
    Promise.all([
      apiFetch<ClassData[]>("/classes"),
      apiFetch<FeeStructure[]>("/fees/structures")
    ]).then(([clsData, feeData]) => {
      setClasses(clsData || []);
      setFeeStructures(feeData || []);
    }).catch(console.error);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        rollNumber: formData.rollNumber ? parseInt(formData.rollNumber) : undefined,
      };
      await apiFetch("/students", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push("/students");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to register student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <PageHeader eyebrow="Students" title="Register new student" />
      
      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-8">
        {/* Personal Details */}
        <section className="space-y-5">
          <h3 className="text-[15px] font-bold text-[#1d1d1f] flex items-center gap-2">
            <span className="h-6 w-1 bg-[#0071e3] rounded-full" />
            Personal Details
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Full Name</label>
              <input
                required
                className="glass-input w-full"
                placeholder="Student's full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Admission Number</label>
                <div className="glass-input w-full bg-[#f5f5f7]/50 text-[#86868b] flex items-center italic">
                  Auto-generated on save
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Roll Number</label>
                <input
                  type="number"
                  className="glass-input w-full"
                  placeholder="e.g. 15"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Gender</label>
                <select
                  required
                  className="glass-input w-full"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Date of Birth</label>
              <input
                type="date"
                className="glass-input w-full"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Academic & Fee Assignment */}
        <section className="space-y-5">
          <h3 className="text-[15px] font-bold text-[#1d1d1f] flex items-center gap-2">
            <span className="h-6 w-1 bg-[#34c759] rounded-full" />
            Academic & Fee Details
          </h3>
          
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Class & Section</label>
              <select
                required
                className="glass-input w-full"
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              >
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name} — Section {cls.section}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Assign Fee Structure</label>
              <select
                className="glass-input w-full"
                value={formData.feeStructureId}
                onChange={(e) => setFormData({ ...formData, feeStructureId: e.target.value })}
              >
                <option value="">Select fee structure</option>
                {feeStructures.map((fs) => (
                  <option key={fs.id} value={fs.id}>{fs.name} (₹{fs.totalAmount}) — {fs.academicYear}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Parent Details */}
        <section className="space-y-5">
          <h3 className="text-[15px] font-bold text-[#1d1d1f] flex items-center gap-2">
            <span className="h-6 w-1 bg-[#ff9500] rounded-full" />
            Guardian Details
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Parent/Guardian Name</label>
              <input
                required
                className="glass-input w-full"
                placeholder="Full name of parent"
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Primary Phone</label>
                <input
                  required
                  className="glass-input w-full"
                  placeholder="Primary contact number"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Alternate Phone (Optional)</label>
                <input
                  className="glass-input w-full"
                  placeholder="Secondary contact number"
                  value={formData.alternatePhone}
                  onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Address</label>
              <textarea
                className="glass-input w-full min-h-[100px] py-3"
                placeholder="Residential address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        </section>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-[rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-[14px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-10 py-2.5 rounded-xl disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register Student"}
          </button>
        </div>
      </form>
    </div>
  );
}
