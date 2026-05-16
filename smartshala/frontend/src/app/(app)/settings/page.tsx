"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { settingsApi, type SchoolProfilePayload } from "@/lib/api";
import { communicationTemplates, renderCommunicationTemplate } from "@/lib/communicationTemplates";

const previewVariables = {
  studentName: "Aarav Patel",
  className: "6-A",
  schoolName: "SmartShala Ahmedabad Public School",
  date: "14 May 2026",
  amount: "INR 2,500",
  dueDate: "20 May 2026",
  examName: "Unit Test 1",
  ptmTime: "10:00 AM",
  holidayReason: "school notice"
};

const emptyProfile: SchoolProfilePayload = {
  name: "",
  city: "",
  state: "",
  phone: "",
  gstin: "",
  udiseNumber: "",
  affiliationBoard: "CBSE",
  logoUrl: ""
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<SchoolProfilePayload>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const row = await settingsApi.schoolProfile();
        if (!active) return;
        setProfile({
          name: row.name,
          city: row.city ?? "",
          state: row.state ?? "",
          phone: row.phone ?? "",
          gstin: row.gstin ?? "",
          udiseNumber: row.udiseNumber ?? "",
          affiliationBoard: row.affiliationBoard ?? "CBSE",
          logoUrl: row.logoUrl ?? ""
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load school profile");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  function updateField<K extends keyof SchoolProfilePayload>(key: K, value: SchoolProfilePayload[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function handleLogoUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateField("logoUrl", String(reader.result ?? ""));
    reader.onerror = () => setError("Unable to read logo file.");
    reader.readAsDataURL(file);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await settingsApi.updateSchoolProfile(profile);
      setProfile({
        name: saved.name,
        city: saved.city ?? "",
        state: saved.state ?? "",
        phone: saved.phone ?? "",
        gstin: saved.gstin ?? "",
        udiseNumber: saved.udiseNumber ?? "",
        affiliationBoard: saved.affiliationBoard ?? "CBSE",
        logoUrl: saved.logoUrl ?? ""
      });
      setNotice("School profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save school profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="School and notification settings" />
      {error ? <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div> : null}
      {notice ? <div className="rounded-xl bg-[#34c759]/10 p-4 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form className="glass-card-interactive space-y-5 p-6" onSubmit={saveProfile}>
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">School profile</h2>

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#DCE1E8] bg-white">
              {profile.logoUrl ? <img alt="" className="h-full w-full object-contain" src={profile.logoUrl} /> : <span className="text-[11px] font-semibold text-[#86868b]">Logo</span>}
            </div>
            <label className="btn-secondary min-h-10 cursor-pointer px-4 text-[13px]">
              Upload logo
              <input accept="image/*" className="sr-only" disabled={loading || saving} onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)} type="file" />
            </label>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">School name</label>
            <input className="glass-input mt-2" disabled={loading || saving} onChange={(event) => updateField("name", event.target.value)} value={profile.name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[13px] font-semibold text-[#1d1d1f]">City</label>
              <input className="glass-input mt-2" disabled={loading || saving} onChange={(event) => updateField("city", event.target.value)} value={profile.city ?? ""} />
            </div>
            <div>
              <label className="text-[13px] font-semibold text-[#1d1d1f]">State</label>
              <input className="glass-input mt-2" disabled={loading || saving} onChange={(event) => updateField("state", event.target.value)} value={profile.state ?? ""} />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">Phone</label>
            <input className="glass-input mt-2" disabled={loading || saving} onChange={(event) => updateField("phone", event.target.value)} value={profile.phone ?? ""} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[13px] font-semibold text-[#1d1d1f]">GSTIN</label>
              <input className="glass-input mt-2 uppercase" disabled={loading || saving} onChange={(event) => updateField("gstin", event.target.value.toUpperCase())} value={profile.gstin ?? ""} />
            </div>
            <div>
              <label className="text-[13px] font-semibold text-[#1d1d1f]">U-DISE number</label>
              <input className="glass-input mt-2" disabled={loading || saving} onChange={(event) => updateField("udiseNumber", event.target.value)} value={profile.udiseNumber ?? ""} />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#1d1d1f]">Affiliation board</label>
            <select className="glass-input mt-2" disabled={loading || saving} onChange={(event) => updateField("affiliationBoard", event.target.value)} value={profile.affiliationBoard ?? "CBSE"}>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="State Board">State Board</option>
              <option value="IB">IB</option>
              <option value="Cambridge">Cambridge</option>
            </select>
          </div>

          <button className="btn-primary min-h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || saving} type="submit">
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>

        <section className="glass-card-interactive p-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">WhatsApp templates</h2>
          <p className="mt-1 text-[13px] text-[#86868b]">English and Hindi variants with live sample variables.</p>
          <div className="mt-5 grid gap-3">
            {communicationTemplates.map((template) => (
              <article className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-white p-4" key={template.type}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1d1d1f]">{template.label}</h3>
                    <p className="text-[12px] font-medium text-[#86868b]">{template.description}</p>
                  </div>
                  <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold text-[#6e6e73]">EN + HI</span>
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <p className="rounded-lg bg-[#f5f5f7] p-3 text-[12px] leading-5 text-[#424245]">
                    {renderCommunicationTemplate(template.variants.en, previewVariables)}
                  </p>
                  <p className="rounded-lg bg-[#f5f5f7] p-3 text-[12px] leading-6 text-[#424245]">
                    {renderCommunicationTemplate(template.variants.hi, previewVariables)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
