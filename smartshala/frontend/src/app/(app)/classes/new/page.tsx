"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormSection, openInvalidFormSection } from "@/components/ui/FormSection";
import { SideModal } from "@/components/ui/SideModal";
import { apiFetch } from "@/lib/api";
import { cachedFetch } from "@/lib/prefetchCache";

type Teacher = { id: string; fullName: string };
const subjectOptions = ["English", "Hindi", "Mathematics", "Science", "Social Studies", "Computer Science", "Sanskrit", "General Knowledge"];

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
    maximumStrength: "",
    stream: "",
    mediumOfInstruction: "English",
  });
  const [subjects, setSubjects] = useState<string[]>(["English", "Hindi", "Mathematics", "Science", "Social Studies"]);
  const [customSubject, setCustomSubject] = useState("");

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

    cachedFetch("teachers:list", () => apiFetch<{ items: Teacher[] }>("/users/teachers?limit=100"))
      .then((data) => setTeachers(data?.items || []))
      .catch(console.error);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const payload: Record<string, any> = {
      ...formData,
      maximumStrength: formData.maximumStrength ? Number(formData.maximumStrength) : undefined,
      stream: formData.stream || undefined,
      subjects
    };
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

  function toggleSubject(subject: string) {
    setSubjects((prev) => prev.includes(subject) ? prev.filter((item) => item !== subject) : [...prev, subject]);
  }

  function addCustomSubject() {
    const value = customSubject.trim();
    if (!value) return;
    setSubjects((prev) => Array.from(new Set([...prev, value])));
    setCustomSubject("");
  }

  return (
    <SideModal eyebrow="Classes" onClose={() => router.back()} title="Create new class">
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
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Maximum Strength</label>
            <input
              min={1}
              type="number"
              className="glass-input w-full"
              placeholder="e.g. 40"
              value={formData.maximumStrength}
              onChange={(e) => setFormData({ ...formData, maximumStrength: e.target.value })}
            />
          </div>
            </div>
          </FormSection>

          <FormSection title="Academic Details">
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
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Medium of Instruction</label>
              <select
                required
                className="glass-input w-full"
                value={formData.mediumOfInstruction}
                onChange={(e) => setFormData({ ...formData, mediumOfInstruction: e.target.value })}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Gujarati">Gujarati</option>
                <option value="Marathi">Marathi</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Stream for higher classes</label>
              <select
                className="glass-input w-full"
                value={formData.stream}
                onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
              >
                <option value="">Not applicable</option>
                <option value="Science">Science</option>
                <option value="Commerce">Commerce</option>
                <option value="Arts">Arts</option>
                <option value="Vocational">Vocational</option>
              </select>
            </div>
            </div>
          </FormSection>

          <FormSection title="Teacher Assignment">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Class Teacher</label>
              <select
                required
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
          </FormSection>

          <FormSection title="Subjects">
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {subjectOptions.map((subject) => (
                  <label key={subject} className="flex items-center gap-3 rounded-lg border border-[#DCE1E8] bg-white px-3 py-2 text-[13px] font-semibold text-[#1d1d1f]">
                    <input
                      checked={subjects.includes(subject)}
                      className="h-4 w-4 accent-[#2456E6]"
                      onChange={() => toggleSubject(subject)}
                      type="checkbox"
                    />
                    {subject}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="glass-input w-full"
                  placeholder="Add custom subject"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                />
                <button className="btn-secondary min-h-[44px] px-4" onClick={addCustomSubject} type="button">Add</button>
              </div>
              {subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((subject) => (
                    <span key={subject} className="inline-flex items-center gap-2 rounded-full bg-[#E2F0FB] px-3 py-1 text-[12px] font-semibold text-[#1F6FB8]">
                      {subject}
                      <button aria-label={`Remove ${subject}`} onClick={() => toggleSubject(subject)} type="button">x</button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">Select at least one subject.</p>
              )}
              <input required className="sr-only" tabIndex={-1} value={subjects.length ? "selected" : ""} onChange={() => undefined} />
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
            {loading ? "Creating..." : "Create Class"}
          </button>
        </div>
      </form>
    </SideModal>
  );
}
