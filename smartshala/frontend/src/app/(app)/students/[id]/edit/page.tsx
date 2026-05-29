"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, studentsApi, type FeeStructure } from "@/lib/api";
import { formatINR } from "@/lib/formatters";
import { cachedFetch, invalidateCache, invalidateCachePrefix } from "@/lib/prefetchCache";

type ClassData = { id: string; name: string; section: string };

type StudentForm = {
  classId: string;
  feeStructureId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string;
  dateOfBirth: string;
  gender: string;
  profilePhotoUrl: string | null;
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
  transportRequired: boolean;
  transportFeeAmount: string;
  isActive: boolean;
};

const emptyForm: StudentForm = {
  classId: "",
  feeStructureId: "",
  fullName: "",
  admissionNumber: "",
  rollNumber: "",
  dateOfBirth: "",
  gender: "",
  profilePhotoUrl: null,
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
  transportRequired: false,
  transportFeeAmount: "",
  isActive: true
};

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "ST";
}

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
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
      cachedFetch("classes:list", () => apiFetch<ClassData[]>("/classes")),
      cachedFetch("fees:structures", () => apiFetch<FeeStructure[]>("/fees/structures"))
    ])
      .then(([student, classRows, feeRows]) => {
        setClasses(classRows || []);
        setFeeStructures(feeRows || []);
        setFormData({
          classId: student.classId,
          feeStructureId: student.feeAssignments?.[0]?.feeStructure.id ?? "",
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber?.toString() ?? "",
          dateOfBirth: dateInput(student.dateOfBirth),
          gender: student.gender ?? "",
          profilePhotoUrl: student.profilePhotoUrl ?? null,
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
          transportRequired: Boolean(student.transportRequired ?? Number(student.feeAssignments?.[0]?.transportFeeAmount ?? 0) > 0),
          transportFeeAmount: String(student.transportFeeAmount ?? student.feeAssignments?.[0]?.transportFeeAmount ?? ""),
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
          ...(formData.feeStructureId ? { feeStructureId: formData.feeStructureId } : {}),
          fullName: formData.fullName.trim(),
          admissionNumber: formData.admissionNumber.trim(),
          rollNumber: formData.rollNumber ? Number(formData.rollNumber) : null,
          dateOfBirth: formData.dateOfBirth || null,
          gender: formData.gender || null,
          profilePhotoUrl: formData.profilePhotoUrl,
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
          transportRequired: formData.transportRequired,
          transportFeeAmount: formData.transportRequired ? Number(formData.transportFeeAmount || 0) : 0,
          isActive: formData.isActive
        })
      });
      invalidateCache(`student:${id}`);
      invalidateCache(`fees:ledger:${id}`);
      invalidateCache("fees:dashboard");
      invalidateCache("fees:defaulters");
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
    return <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-6 text-[13px] font-medium text-[#86868b]">Loading student...</div>;
  }

  function selectPhoto(file: File | null) {
    if (!file) return;
    const allowedTypes = new Set(["image/jpeg", "image/png"]);
    if (!allowedTypes.has(file.type)) {
      setErrorMsg("Student photo must be a JPG or PNG file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Student photo must be 5MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFormData((current) => ({ ...current, profilePhotoUrl: typeof reader.result === "string" ? reader.result : null }));
    reader.onerror = () => setErrorMsg("Unable to read student photo.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <PageHeader eyebrow="Students" title="Edit student details" />

      {errorMsg ? (
        <div className="rounded-[6px] border border-[#FCE3E5] bg-[rgba(255,59,48,0.1)] p-4 text-[13px] font-medium text-[#d70015]">
          {errorMsg}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8 rounded-[6px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-8">
        <section className="space-y-4">
          <h3 className="text-[15px] font-bold text-[#1d1d1f]">Student</h3>
          <div className="flex flex-col gap-4 rounded-[6px] border border-[#DCE1E8] bg-[#F7F8FB] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-[#EAF3FB]">
                {formData.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={formData.fullName} className="h-full w-full object-cover" src={formData.profilePhotoUrl} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[14px] font-bold text-[#0F2557]">{initials(formData.fullName)}</div>
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">Student profile photo</p>
                <p className="mt-1 text-[12px] font-medium text-[#5A6573]">JPG or PNG up to 5MB.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white px-4 py-2 text-[13px] font-semibold text-[#2456E6] hover:bg-[#F7F8FB]">
                {formData.profilePhotoUrl ? "Change photo" : "Upload photo"}
                <input accept="image/jpeg,image/png" className="sr-only" type="file" onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} />
              </label>
              {formData.profilePhotoUrl ? (
                <button className="rounded-[6px] border border-[#F1B8BD] bg-white px-4 py-2 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5]" onClick={() => setFormData({ ...formData, profilePhotoUrl: null })} type="button">
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Full name</span>
              <input required minLength={2} className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Admission number</span>
              <input required className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]" value={formData.admissionNumber} onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Class & section</span>
              <select required className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]" value={formData.classId} onChange={(e) => setFormData({ ...formData, classId: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} - Section {item.section}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Fee structure</span>
              <select className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]" value={formData.feeStructureId} onChange={(e) => setFormData({ ...formData, feeStructureId: e.target.value })}>
                <option value="">Select fee structure</option>
                {feeStructures.map((feeStructure) => (
                  <option key={feeStructure.id} value={feeStructure.id}>
                    {feeStructure.name} ({formatINR(feeStructure.totalAmount, { compact: false })}) - {feeStructure.academicYear}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-[46px] items-center gap-2 rounded-[6px] border border-[#DCE1E8] bg-white px-4 py-3 text-[13px] font-semibold text-[#1d1d1f]">
              <input
                checked={formData.transportRequired}
                className="rounded border-[rgba(0,0,0,0.1)] text-[#2456E6] focus:ring-[#2456E6]"
                onChange={(e) => setFormData({ ...formData, transportRequired: e.target.checked, transportFeeAmount: e.target.checked ? formData.transportFeeAmount : "" })}
                type="checkbox"
              />
              Uses school transportation
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Transportation fee</span>
              <input
                className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6] disabled:bg-[#F7F8FB] disabled:text-[#86868b]"
                disabled={!formData.transportRequired}
                min={0}
                placeholder="e.g. 12000"
                type="number"
                value={formData.transportFeeAmount}
                onChange={(e) => setFormData({ ...formData, transportFeeAmount: e.target.value })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Roll number</span>
              <input className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]" min={1} type="number" value={formData.rollNumber} onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Date of birth</span>
              <DatePicker
                buttonClassName="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[6px] border border-[#C9D3DE] bg-white px-3 py-2.5 text-left text-[14px] outline-none focus:border-[#2456E6]"
                max={new Date().toISOString().slice(0, 10)}
                onChange={(value) => setFormData({ ...formData, dateOfBirth: value })}
                value={formData.dateOfBirth}
              />
            </label>
            <label className="space-y-1.5">
              <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Gender</span>
              <select className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
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
                  className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                  value={String(formData[key as keyof StudentForm])}
                  onChange={(e) => setFormData({ ...formData, [key as string]: e.target.value } as StudentForm)}
                />
              </label>
            ))}
          </div>
          <label className="block space-y-1.5">
            <span className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Address</span>
            <textarea className="min-h-[100px] w-full rounded-[6px] border border-[#C9D3DE] px-3 py-3 text-[14px] outline-none focus:border-[#2456E6]" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f]">
            <input checked={formData.isActive} className="rounded border-[rgba(0,0,0,0.1)]" type="checkbox" onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
            Student active
          </label>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-[#E7EBF0] pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button className="rounded-[6px] border border-[#C9D3DE] bg-white px-6 py-2.5 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#F7F8FB]" onClick={() => router.back()} type="button">
            Cancel
          </button>
          <button className="btn-primary gap-2 rounded-[6px] px-10 py-2.5 disabled:opacity-50" disabled={saving} type="submit">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
