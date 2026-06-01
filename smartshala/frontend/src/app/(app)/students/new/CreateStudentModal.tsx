"use client";

import { useState, useEffect } from "react";
import { FormSection, openInvalidFormSection } from "@/components/ui/FormSection";
import { SideModal } from "@/components/ui/SideModal";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

type ClassData = { id: string; name: string; section: string };
type FeeStructure = { id: string; name: string; totalAmount: number; academicYear: string };

type CreateStudentModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

function dateDisplayToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) throw new Error("Date of birth must be in dd/mm/yyyy format.");

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Date of birth must be a valid calendar date.");
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CreateStudentModal({ onClose, onCreated }: CreateStudentModalProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [studentPhotoUrl, setStudentPhotoUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: "",
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
    classId: "",
    feeStructureId: "",
    transportRequired: false,
    transportFeeAmount: "",
    aadhaar: "",
    apaar: "",
    previousSchool: "",
    siblingDiscount: false,
  });

  useEffect(() => {
    Promise.all([
      cachedFetch("classes:list", () => apiFetch<ClassData[]>("/classes")),
      cachedFetch("fees:structures", () => apiFetch<FeeStructure[]>("/fees/structures"))
    ]).then(([clsData, feeData]) => {
      setClasses(clsData || []);
      setFeeStructures(feeData || []);
    }).catch(console.error);
  }, []);

  function selectPhoto(file: File | null) {
    if (!file) {
      return;
    }

    const allowedTypes = new Set(["image/jpeg", "image/png"]);
    if (!allowedTypes.has(file.type)) {
      setErrorMsg("Student photo must be a JPG or PNG file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Student photo must be 5MB or smaller.");
      return;
    }

    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = () => setStudentPhotoUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setErrorMsg("Unable to read student photo.");
    reader.readAsDataURL(file);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const payload: any = { ...formData };
      const primaryGuardian = [
        { name: payload.fatherName, phone: payload.fatherPhone },
        { name: payload.motherName, phone: payload.motherPhone },
        { name: payload.guardianName, phone: payload.guardianPhone }
      ].find((guardian) => String(guardian.name ?? "").trim() && String(guardian.phone ?? "").trim());

      if (!primaryGuardian) {
        throw new Error("Add at least one guardian with name and phone.");
      }

      payload.parentName = primaryGuardian.name;
      payload.parentPhone = primaryGuardian.phone;
      if (!payload.rollNumber) delete payload.rollNumber;
      else payload.rollNumber = parseInt(payload.rollNumber);
      
      if (!payload.dateOfBirth) delete payload.dateOfBirth;
      else payload.dateOfBirth = dateDisplayToIso(payload.dateOfBirth);
      if (!payload.gender) delete payload.gender;
      if (!payload.alternatePhone) {
        const alternate = [payload.motherPhone, payload.fatherPhone, payload.guardianPhone].find((phone) => phone && phone !== payload.parentPhone);
        if (alternate) payload.alternatePhone = alternate;
      }
      [
        "alternatePhone",
        "fatherName",
        "fatherPhone",
        "fatherOccupation",
        "motherName",
        "motherPhone",
        "motherOccupation",
        "guardianName",
        "guardianPhone",
        "guardianOccupation",
        "address"
      ].forEach((key) => {
        if (!payload[key]) delete payload[key];
      });
      if (!payload.feeStructureId) delete payload.feeStructureId;
      payload.transportRequired = Boolean(payload.transportRequired);
      payload.transportFeeAmount = payload.transportRequired ? Number(payload.transportFeeAmount || 0) : 0;
      if (!payload.aadhaar) delete payload.aadhaar;
      if (!payload.apaar) delete payload.apaar;
      if (!payload.previousSchool) delete payload.previousSchool;
      payload.profilePhotoUrl = studentPhotoUrl;
      
      await apiFetch<{ id: string }>("/students", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onCreated();
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to register student. Please ensure all required fields are filled correctly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideModal eyebrow="Students" onClose={onClose} title="Register new student" width="lg">
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-[6px] border border-[#FCE3E5] bg-[rgba(255,59,48,0.1)] p-4 text-[13px] font-medium text-[#d70015]">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      <form onInvalid={openInvalidFormSection} onSubmit={handleSubmit} className="space-y-5">
        {/* Personal Details */}
        <div>
        <FormSection title="Personal Details" defaultOpen>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Full Name <span className="text-[#ff3b30]">*</span></label>
              <input
                required
                className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                placeholder="Student's full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Admission Number</label>
                <div className="flex w-full items-center rounded-[6px] border border-[#C9D3DE] bg-[#F7F8FB] px-3 py-2.5 text-[14px] italic text-[#86868b]">
                  Auto-generated on save
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Roll Number</label>
                <input
                  type="number"
                  className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                  placeholder="e.g. 15"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Gender <span className="text-[#ff3b30]">*</span></label>
                <select
                  required
                  className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
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
                inputMode="numeric"
                pattern="\d{2}/\d{2}/\d{4}"
                className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                placeholder="dd/mm/yyyy"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
              <p className="ml-1 text-[12px] font-medium text-[#5A6573]">Format: dd/mm/yyyy</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Aadhaar Number</label>
                <input
                  className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                  placeholder="12-digit Aadhaar number"
                  value={formData.aadhaar}
                  onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">APAAR ID</label>
                <input
                  className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                  placeholder="12-digit APAAR ID"
                  value={formData.apaar}
                  onChange={(e) => setFormData({ ...formData, apaar: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-[#EAF3FB]">
                    {studentPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="Student preview" className="h-full w-full object-cover" src={studentPhotoUrl} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-[#0F2557]">
                        {formData.fullName.trim().split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST"}
                      </div>
                    )}
                  </div>
                  <div>
                  <label className="text-[13px] font-semibold text-[#1d1d1f]">Student photo</label>
                  <p className="mt-1 text-[12px] font-medium text-[#5A6573]">JPG or PNG up to 5MB.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white px-4 py-2 text-[13px] font-semibold text-[#2456E6] transition-colors hover:bg-[#F7F8FB]">
                    {studentPhotoUrl ? "Change photo" : "Upload photo"}
                    <input
                      accept="image/jpeg,image/png"
                      className="sr-only"
                      type="file"
                      onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {studentPhotoUrl ? (
                    <button className="rounded-[6px] border border-[#F1B8BD] bg-white px-4 py-2 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5]" onClick={() => setStudentPhotoUrl(null)} type="button">
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Academic & Fee Assignment */}
        <FormSection title="Academic & Fee Details">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Class & Section <span className="text-[#ff3b30]">*</span></label>
              <select
                required
                className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
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
                className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                value={formData.feeStructureId}
                onChange={(e) => setFormData({ ...formData, feeStructureId: e.target.value })}
              >
                <option value="">Select fee structure</option>
                {feeStructures.map((fs) => (
                  <option key={fs.id} value={fs.id}>{fs.name} ({formatINR(fs.totalAmount, { compact: false })}) — {fs.academicYear}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex items-center rounded-[6px] border border-[#DCE1E8] bg-white px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  checked={formData.transportRequired}
                  className="rounded border-[rgba(0,0,0,0.1)] text-[#2456E6] focus:ring-[#2456E6]"
                  onChange={(e) => setFormData({ ...formData, transportRequired: e.target.checked })}
                  type="checkbox"
                />
                <span className="text-[13px] font-semibold text-[#1d1d1f]">Uses school transportation</span>
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Transportation Fee</label>
              <input
                className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                disabled={!formData.transportRequired}
                inputMode="decimal"
                min="0"
                placeholder="e.g. 5000"
                type="number"
                value={formData.transportFeeAmount}
                onChange={(e) => setFormData({ ...formData, transportFeeAmount: e.target.value })}
              />
              <p className="ml-1 text-[12px] font-medium text-[#5A6573]">Added to selected fee structure total for this student.</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Previous School</label>
              <input
                className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                placeholder="Name of previous school (if any)"
                value={formData.previousSchool}
                onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
              />
            </div>
            <div className="flex items-center mt-7">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-[rgba(0,0,0,0.1)] text-[#0071e3] focus:ring-[#0071e3]"
                  checked={formData.siblingDiscount}
                  onChange={(e) => setFormData({ ...formData, siblingDiscount: e.target.checked })}
                />
                <span className="text-[13px] font-semibold text-[#1d1d1f]">Apply Sibling Discount</span>
              </label>
            </div>
          </div>
        </FormSection>

        {/* Parent Details */}
        <FormSection title="Guardian Details">
          <div className="space-y-5">
            <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[14px] font-semibold text-[#1d1d1f]">Father</h4>
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Primary if first filled</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Name</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="Father name"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Phone</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="10-digit mobile"
                    value={formData.fatherPhone}
                    onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Occupation</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="e.g. Business"
                    value={formData.fatherOccupation}
                    onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4">
              <h4 className="mb-3 text-[14px] font-semibold text-[#1d1d1f]">Mother</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Name</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="Mother name"
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Phone</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="10-digit mobile"
                    value={formData.motherPhone}
                    onChange={(e) => setFormData({ ...formData, motherPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Occupation</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="e.g. Teacher"
                    value={formData.motherOccupation}
                    onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#DCE1E8] bg-white p-4">
              <h4 className="mb-3 text-[14px] font-semibold text-[#1d1d1f]">Other guardian</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Name</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="Guardian name"
                    value={formData.guardianName}
                    onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Phone</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="10-digit mobile"
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Occupation</label>
                  <input
                    className="w-full rounded-[6px] border border-[#C9D3DE] px-3 py-2.5 text-[14px] outline-none focus:border-[#2456E6]"
                    placeholder="e.g. Retired"
                    value={formData.guardianOccupation}
                    onChange={(e) => setFormData({ ...formData, guardianOccupation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <p className="text-[12px] font-medium text-[#5A6573]">At least one guardian must have name and phone.</p>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#1d1d1f] ml-1">Address</label>
              <textarea
                className="min-h-[100px] w-full rounded-[6px] border border-[#C9D3DE] px-3 py-3 text-[14px] outline-none focus:border-[#2456E6]"
                placeholder="Residential address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        </FormSection>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-[rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#C9D3DE] bg-white px-6 py-2.5 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#F7F8FB]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary gap-2 rounded-[6px] px-10 py-2.5 disabled:opacity-50"
          >
            {loading ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {loading ? "Registering..." : "Register Student"}
          </button>
        </div>
      </form>
    </SideModal>
  );
}
