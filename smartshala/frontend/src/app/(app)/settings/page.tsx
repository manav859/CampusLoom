"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { settingsApi, type DatabaseDeletionStatus, type SchoolProfilePayload } from "@/lib/api";
import { communicationTemplates, renderCommunicationTemplate } from "@/lib/communicationTemplates";
import { invalidateCache } from "@/lib/prefetchCache";

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
  udiseNumber: "",
  affiliationBoard: "CBSE",
  logoUrl: "",
  timetablePeriodCount: 8
};

const templateStorageKey = "smartshala.communicationTemplates";
const fieldClass = "mt-2 min-h-[44px] w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-medium text-[#031526] outline-none transition focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10 disabled:bg-[#F3F6F9] disabled:text-[#8A96A3]";
const textAreaClass = `${fieldClass} min-h-[120px] resize-y py-3 leading-6`;

type TemplateDrafts = Record<string, { en: string; hi: string }>;

function defaultTemplateDrafts(): TemplateDrafts {
  return Object.fromEntries(communicationTemplates.map((template) => [template.type, { ...template.variants }]));
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SchoolProfilePayload>(emptyProfile);
  const [templateDrafts, setTemplateDrafts] = useState<TemplateDrafts>(() => defaultTemplateDrafts());
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletionStatus, setDeletionStatus] = useState<DatabaseDeletionStatus | null>(null);
  const [deletionPassword, setDeletionPassword] = useState("");
  const [deletionPasswordVerified, setDeletionPasswordVerified] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [deletionNotice, setDeletionNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const [row, deletion] = await Promise.all([
          settingsApi.schoolProfile(),
          settingsApi.databaseDeletionStatus().catch(() => null)
        ]);
        if (!active) return;
        setProfile({
          name: row.name,
          city: row.city ?? "",
          state: row.state ?? "",
          phone: row.phone ?? "",
          udiseNumber: row.udiseNumber ?? "",
          affiliationBoard: row.affiliationBoard ?? "CBSE",
          logoUrl: row.logoUrl ?? "",
          timetablePeriodCount: row.timetablePeriodCount ?? 8
        });
        setDeletionStatus(deletion);
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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(templateStorageKey);
      if (saved) setTemplateDrafts({ ...defaultTemplateDrafts(), ...JSON.parse(saved) });
    } catch {
      setTemplateDrafts(defaultTemplateDrafts());
    }
  }, []);

  const deletionPending = deletionStatus?.deletionStatus === "PENDING";
  const scheduledDeletion = deletionStatus?.deletionScheduledAt
    ? new Date(deletionStatus.deletionScheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const editedCount = useMemo(
    () => communicationTemplates.filter((template) => {
      const draft = templateDrafts[template.type];
      return draft && (draft.en !== template.variants.en || draft.hi !== template.variants.hi);
    }).length,
    [templateDrafts]
  );

  function updateField<K extends keyof SchoolProfilePayload>(key: K, value: SchoolProfilePayload[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateTemplate(type: string, language: "en" | "hi", value: string) {
    setTemplateDrafts((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [language]: value
      }
    }));
  }

  async function persistProfile(nextProfile: SchoolProfilePayload, successMessage: string) {
    const saved = await settingsApi.updateSchoolProfile(nextProfile);
    const normalized = {
      name: saved.name,
      city: saved.city ?? "",
      state: saved.state ?? "",
      phone: saved.phone ?? "",
      udiseNumber: saved.udiseNumber ?? "",
      affiliationBoard: saved.affiliationBoard ?? "CBSE",
      logoUrl: saved.logoUrl ?? "",
      timetablePeriodCount: saved.timetablePeriodCount ?? 8
    };
    setProfile(normalized);
    invalidateCache("settings:schoolProfile");
    window.dispatchEvent(new CustomEvent("smartshala:school-logo", { detail: { logoUrl: normalized.logoUrl } }));
    setNotice(successMessage);
  }

  function handleLogoUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const logoUrl = String(reader.result ?? "");
      const nextProfile = { ...profile, logoUrl };
      setLogoSaving(true);
      setError("");
      setNotice("");
      setProfile(nextProfile);
      try {
        await persistProfile(nextProfile, "School logo saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save logo");
      } finally {
        setLogoSaving(false);
      }
    };
    reader.onerror = () => setError("Unable to read logo file.");
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    const nextProfile = { ...profile, logoUrl: "" };
    setLogoSaving(true);
    setError("");
    setNotice("");
    setProfile(nextProfile);
    try {
      await persistProfile(nextProfile, "School logo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove logo");
    } finally {
      setLogoSaving(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await persistProfile(profile, "School profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save school profile");
    } finally {
      setSaving(false);
    }
  }

  function saveTemplates() {
    setSavingTemplates(true);
    setNotice("");
    setError("");
    try {
      window.localStorage.setItem(templateStorageKey, JSON.stringify(templateDrafts));
      setNotice("WhatsApp templates saved.");
      setEditingTemplate(null);
    } catch {
      setError("Unable to save templates in this browser.");
    } finally {
      setSavingTemplates(false);
    }
  }

  function resetTemplates() {
    const defaults = defaultTemplateDrafts();
    setTemplateDrafts(defaults);
    window.localStorage.removeItem(templateStorageKey);
    setEditingTemplate(null);
    setNotice("WhatsApp templates reset.");
  }

  async function requestDeletion() {
    setDeletionBusy(true);
    setDeletionError("");
    setDeletionNotice("");
    try {
      const status = await settingsApi.requestDatabaseDeletion(deletionPassword);
      setDeletionStatus(status);
      setDeletionPassword("");
      setDeletionPasswordVerified(false);
      setDeletionNotice("Database deletion scheduled. You can cancel it before the scheduled date.");
      window.localStorage.removeItem("smartshala.accessToken");
      window.localStorage.removeItem("smartshala.refreshToken");
      window.localStorage.removeItem("smartshala.user");
      router.replace("/login");
    } catch (err) {
      setDeletionError(err instanceof Error ? err.message : "Unable to schedule database deletion");
    } finally {
      setDeletionBusy(false);
    }
  }

  async function verifyDeletionPassword() {
    setDeletionBusy(true);
    setDeletionError("");
    setDeletionNotice("");
    setDeletionPasswordVerified(false);
    try {
      await settingsApi.verifyDatabaseDeletionPassword(deletionPassword);
      setDeletionPasswordVerified(true);
      setDeletionNotice("Password verified. Confirm below to schedule deletion.");
    } catch {
      setDeletionError("Password incorrect.");
    } finally {
      setDeletionBusy(false);
    }
  }

  async function cancelDeletion() {
    setDeletionBusy(true);
    setDeletionError("");
    setDeletionNotice("");
    try {
      const status = await settingsApi.cancelDatabaseDeletion(deletionPassword);
      setDeletionStatus(status);
      setDeletionPassword("");
      setDeletionPasswordVerified(false);
      setDeletionNotice("Database deletion cancelled.");
    } catch (err) {
      setDeletionError(err instanceof Error ? err.message : "Unable to cancel database deletion");
    } finally {
      setDeletionBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader hideBreadcrumbs title="School and notification settings" />
      {error ? <div className="rounded-[6px] border border-[#FCE3E5] bg-[#FCE3E5] p-4 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}
      {notice ? <div className="rounded-[6px] border border-[#D6F0DF] bg-[#E1F5EA] p-4 text-[13px] font-semibold text-[#0F8A4A]">{notice}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form className="space-y-5 rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6" onSubmit={saveProfile}>
          <h2 className="text-[17px] font-semibold text-[#031526]">School profile</h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-white">
              {profile.logoUrl ? <img alt="" className="h-full w-full object-contain" src={profile.logoUrl} /> : <span className="text-[11px] font-semibold text-[#86868b]">Logo</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]">
                {profile.logoUrl ? "Change logo" : "Upload logo"}
                <input accept="image/*" className="sr-only" disabled={loading || saving || logoSaving} onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)} type="file" />
              </label>
              {profile.logoUrl ? (
                <button
                  className="min-h-10 rounded-[6px] border border-[#F2B8B5] bg-white px-4 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FFF1F0] disabled:opacity-50"
                  disabled={loading || saving || logoSaving}
                  onClick={removeLogo}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
              {logoSaving ? <span className="flex min-h-10 items-center text-[12px] font-semibold text-[#5A6573]">Saving logo...</span> : null}
            </div>
          </div>

          <label className="block">
            <span className="text-[13px] font-semibold text-[#031526]">School name</span>
            <input className={fieldClass} disabled={loading || saving} onChange={(event) => updateField("name", event.target.value)} value={profile.name} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#031526]">City</span>
              <input className={fieldClass} disabled={loading || saving} onChange={(event) => updateField("city", event.target.value)} value={profile.city ?? ""} />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#031526]">State</span>
              <input className={fieldClass} disabled={loading || saving} onChange={(event) => updateField("state", event.target.value)} value={profile.state ?? ""} />
            </label>
          </div>

          <label className="block">
            <span className="text-[13px] font-semibold text-[#031526]">Phone</span>
            <input className={fieldClass} disabled={loading || saving} onChange={(event) => updateField("phone", event.target.value)} value={profile.phone ?? ""} />
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[#031526]">U-DISE number</span>
            <input className={fieldClass} disabled={loading || saving} onChange={(event) => updateField("udiseNumber", event.target.value)} value={profile.udiseNumber ?? ""} />
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[#031526]">Affiliation board</span>
            <select className={fieldClass} disabled={loading || saving} onChange={(event) => updateField("affiliationBoard", event.target.value)} value={profile.affiliationBoard ?? "CBSE"}>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="State Board">State Board</option>
              <option value="IB">IB</option>
              <option value="Cambridge">Cambridge</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[#031526]">Periods per day</span>
            <input className={fieldClass} disabled={loading || saving} max={12} min={1} onChange={(event) => updateField("timetablePeriodCount", Number(event.target.value))} type="number" value={profile.timetablePeriodCount ?? 8} />
            <span className="mt-1 block text-[12px] font-medium text-[#5A6573]">Used by teacher timetable assignment and free-period planning.</span>
          </label>

          <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" disabled={loading || saving} type="submit">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>

        <section className="rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#031526]">WhatsApp templates</h2>
              <p className="mt-1 text-[13px] font-medium text-[#5A6573]">Edit English and Hindi variants, then save below.</p>
            </div>
            <span className="w-fit rounded-full bg-[#F7F8FB] px-3 py-1 text-[12px] font-semibold text-[#5A6573]">{editedCount} edited</span>
          </div>

          <div className="mt-5 grid gap-3">
            {communicationTemplates.map((template) => {
              const draft = templateDrafts[template.type] ?? template.variants;
              const editing = editingTemplate === template.type;
              return (
                <article className="rounded-[6px] border border-[#DCE1E8] bg-white p-4" key={template.type}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#031526]">{template.label}</h3>
                      <p className="mt-1 text-[12px] font-medium text-[#5A6573]">{template.description}</p>
                    </div>
                    <button
                      aria-label={`Edit ${template.label}`}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border text-[#2456E6] ${editing ? "border-[#2456E6] bg-[#EEF3FF]" : "border-[#C9D3DE] bg-white hover:bg-[#F7F8FB]"}`}
                      onClick={() => setEditingTemplate(editing ? null : template.type)}
                      type="button"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M16.862 4.487 19.5 7.125M18.187 3.162a1.875 1.875 0 0 1 2.651 2.651L8.25 18.401 4.5 19.5l1.099-3.75L18.187 3.162Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>

                  {editing ? (
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <label className="block">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6573]">English</span>
                        <textarea className={textAreaClass} onChange={(event) => updateTemplate(template.type, "en", event.target.value)} value={draft.en} />
                      </label>
                      <label className="block">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6573]">Hindi</span>
                        <textarea className={textAreaClass} onChange={(event) => updateTemplate(template.type, "hi", event.target.value)} value={draft.hi} />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                      <p className="rounded-[6px] bg-[#F7F8FB] p-3 text-[12px] leading-5 text-[#424B57]">{renderCommunicationTemplate(draft.en, previewVariables)}</p>
                      <p className="rounded-[6px] bg-[#F7F8FB] p-3 text-[12px] leading-6 text-[#424B57]">{renderCommunicationTemplate(draft.hi, previewVariables)}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#DCE1E8] pt-4 sm:flex-row sm:justify-end">
            <button className="min-h-11 rounded-[6px] border border-[#C2C9D4] bg-white px-5 text-[14px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" onClick={resetTemplates} type="button">
              Reset templates
            </button>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50" disabled={savingTemplates} onClick={saveTemplates} type="button">
              {savingTemplates ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
              {savingTemplates ? "Saving..." : "Save templates"}
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-[6px] border border-[#F2B8B5] bg-[#FFF8F8] p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#C8242C]">Danger zone</p>
            <h2 className="mt-2 text-[20px] font-semibold text-[#031526]">Delete this school database</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#5A6573]">This schedules deletion of the current school's Neon database after 3 days. The school remains usable during the waiting period, and an admin can cancel before the scheduled time.</p>
            {deletionStatus ? (
              <div className="mt-4 rounded-[6px] border border-[#F2B8B5] bg-white p-4 text-[13px] text-[#424B57]">
                <p>Status: <span className="font-semibold">{deletionStatus.deletionStatus}</span></p>
                <p>Database: <span className="font-semibold">{deletionStatus.dbName}</span></p>
                {scheduledDeletion ? <p>Scheduled deletion: <span className="font-semibold">{scheduledDeletion}</span></p> : null}
              </div>
            ) : null}
          </div>

          <div className="w-full max-w-md rounded-[6px] border border-[#F2B8B5] bg-white p-4">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#031526]">Admin password</span>
              <input
                className={fieldClass}
                disabled={deletionBusy}
                onChange={(event) => {
                  setDeletionPassword(event.target.value);
                  setDeletionPasswordVerified(false);
                  setDeletionError("");
                  setDeletionNotice("");
                }}
                placeholder="Enter your password"
                type="password"
                value={deletionPassword}
              />
            </label>
            {deletionError ? <p className="mt-3 rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{deletionError}</p> : null}
            {deletionNotice ? <p className="mt-3 rounded-[6px] bg-[#E1F5EA] px-3 py-2 text-[12px] font-semibold text-[#0F8A4A]">{deletionNotice}</p> : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {deletionPending ? (
                <button className="min-h-11 flex-1 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50" disabled={deletionBusy || deletionPassword.length < 8} onClick={cancelDeletion} type="button">
                  {deletionBusy ? "Cancelling..." : "Cancel deletion"}
                </button>
              ) : !deletionPasswordVerified ? (
                <button className="min-h-11 flex-1 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50" disabled={deletionBusy || deletionPassword.length < 8} onClick={verifyDeletionPassword} type="button">
                  {deletionBusy ? "Checking..." : "Verify password"}
                </button>
              ) : (
                <button className="min-h-11 flex-1 rounded-[6px] bg-[#C8242C] px-5 text-[14px] font-semibold text-white hover:bg-[#A51D24] disabled:cursor-not-allowed disabled:opacity-50" disabled={deletionBusy || deletionPassword.length < 8} onClick={requestDeletion} type="button">
                  {deletionBusy ? "Scheduling..." : "Confirm deletion in 3 days"}
                </button>
              )}
            </div>
            {!deletionPending && deletionPasswordVerified ? <p className="mt-3 text-[12px] font-semibold text-[#C8242C]">Confirmation required. This will schedule database deletion after 3 days.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
