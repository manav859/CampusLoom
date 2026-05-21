"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, studentsApi } from "@/lib/api";
import { cachedFetch, invalidateCache, invalidateCachePrefix } from "@/lib/prefetchCache";

type ClassData = { id: string; name: string; section: string };

type StudentForm = {
  classId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string;
  dateOfBirth: string;
  gender: string;
  parentName: string;
  parentPhone: string;
  alternatePhone: string;
  fatherName: string;
  fatherPhone: string;
  fatherOccupation: string;
  motherName: string;
  motherPhone: string;
  motherOccupation: string;
  guardianName: string;
  guardianPhone: string;
  guardianOccupation: string;
  address: string;
  isActive: boolean;
};

const emptyForm: StudentForm = {
  classId: "",
  fullName: "",
  admissionNumber: "",
  rollNumber: "",
  dateOfBirth: "",
  gender: "",
  parentName: "",
  parentPhone: "",
  alternatePhone: "",
  fatherName: "",
  fatherPhone: "",
  fatherOccupation: "",
  motherName: "",
  motherPhone: "",
  motherOccupation: "",
  guardianName: "",
  guardianPhone: "",
  guardianOccupation: "",
  address: "",
  isActive: true
};

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [formData, setFormData] = useState<StudentForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.role !== "ADMIN" && user.role !== "PRINCIPAL") {
          router.replace(`/students/${id}`);
          return;
        }
      } catch (error) {
        console.error(error);
      }
    }

    Promise.all([
      studentsApi.get(id),
      cachedFetch("classes:list", () => apiFetch<ClassData[]>("/classes"))
    ])
      .then(([student, classRows]) => {
        setClasses(classRows || []);
        setFormData({
          classId: student.classId,
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber?.toString() ?? "",
          dateOfBirth: dateInput(student.dateOfBirth),
          gender: student.gender ?? "",
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          alternatePhone: student.alternatePhone ?? "",
          fatherName: student.fatherName ?? "",
          fatherPhone: student.fatherPhone ?? "",
          fatherOccupation: student.fatherOccupation ?? "",
          motherName: student.motherName ?? "",
          motherPhone: student.motherPhone ?? "",
          motherOccupation: student.motherOccupation ?? "",
          guardianName: student.guardianName ?? "",
          guardianPhone: student.guardianPhone ?? "",
          guardianOccupation: student.guardianOccupation ?? "",
          address: student.address ?? "",
          isActive: student.isActive
        });
      })
      .catch((error) => setErrorMsg(error instanceof Error ? error.message : "Unable to load student"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrorMsg("");
    try {
      await apiFetch(`/students/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          classId: formData.classId,
          fullName: formData.fullName.trim(),
          admissionNumber: formData.admissionNumber.trim(),
          rollNumber: formData.rollNumber ? Number(formData.rollNumber) : null,
          dateOfBirth: formData.dateOfBirth || null,
          gender: formData.gender || null,
          parentName: formData.parentName.trim(),
          parentPhone: formData.parentPhone.trim(),
          alternatePhone: textOrNull(formData.alternatePhone),
          fatherName: textOrNull(formData.fatherName),
          fatherPhone: textOrNull(formData.fatherPhone),
          fatherOccupation: textOrNull(formData.fatherOccupation),
          motherName: textOrNull(formData.motherName),
          motherPhone: textOrNull(formData.motherPhone),
          motherOccupation: textOrNull(formData.motherOccupation),
          guardianName: textOrNull(formData.guardianName),
          guardianPhone: textOrNull(formData.guardianPhone),
          guardianOccupation: textOrNull(formData.guardianOccupation),
          address: textOrNull(formData.address),
          isActive: formData.isActive
        })
      });
      invalidateCache(`student:${id}`);
      invalidateCachePrefix("students:list:");
      router.push(`/students/${id}`);
      router.refresh();
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to update student.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl bg-white p-6 text-[13px] font-medium text-[#86868b] shadow-apple-sm">Loading student...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <PageHeader eyebrow="Students" title="Edit student details" />

      {errorMsg ? (
        <div className="rounded-xl border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.1)] p-4 text-[13px] font-medium text-[#d70015]">
          {errorMsg}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="glass-card space-y-8 p-8">
        <section className="space-y-4">
          <h3 className="text-[15px] font-bold text-[#1d1d1f]">Student</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Full name</span>
              <input required minLength={2} className="glass-input w-full" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Admission number</span>
              <input required className="glass-input w-full" value={formData.admissionNumber} onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Class & section</span>
              <select required className="glass-input w-full" value={formData.classId} onChange={(e) => setFormData({ ...formData, classId: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} - Section {item.section}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Roll number</span>
              <input className="glass-input w-full" min={1} type="number" value={formData.rollNumber} onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Date of birth</span>
              <input className="glass-input w-full" type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Gender</span>
              <select className="glass-input w-full" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[15px] font-bold text-[#1d1d1f]">Guardian details</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["parentName", "Primary parent name", true],
              ["parentPhone", "Primary parent phone", true],
              ["alternatePhone", "Alternate phone", false],
              ["fatherName", "Father name", false],
              ["fatherPhone", "Father phone", false],
              ["fatherOccupation", "Father occupation", false],
              ["motherName", "Mother name", false],
              ["motherPhone", "Mother phone", false],
              ["motherOccupation", "Mother occupation", false],
              ["guardianName", "Other guardian name", false],
              ["guardianPhone", "Other guardian phone", false],
              ["guardianOccupation", "Other guardian occupation", false]
            ].map(([key, label, required]) => (
              <label className="space-y-1.5" key={key as string}>
                <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">{label}</span>
                <input
                  required={Boolean(required)}
                  minLength={String(key).includes("Phone") ? 10 : undefined}
                  className="glass-input w-full"
                  value={String(formData[key as keyof StudentForm])}
                  onChange={(e) => setFormData({ ...formData, [key as string]: e.target.value } as StudentForm)}
                />
              </label>
            ))}
          </div>
          <label className="block space-y-1.5">
            <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Address</span>
            <textarea className="glass-input min-h-[100px] w-full py-3" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f]">
            <input checked={formData.isActive} className="rounded border-[rgba(0,0,0,0.1)]" type="checkbox" onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
            Student active
          </label>
        </section>

        <div className="flex items-center justify-end gap-3 border-t border-[rgba(0,0,0,0.06)] pt-4">
          <button className="rounded-xl px-6 py-2.5 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]" onClick={() => router.back()} type="button">
            Cancel
          </button>
          <button className="btn-primary gap-2 rounded-xl px-10 py-2.5 disabled:opacity-50" disabled={saving} type="submit">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
