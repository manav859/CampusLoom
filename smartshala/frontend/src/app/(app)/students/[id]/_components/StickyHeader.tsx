"use client";

import { useState } from "react";
import Link from "next/link";
import { KpiIcon, MarqueeText } from "@/components/ui/KpiCard";
import { studentsApi, type StudentDetail } from "@/lib/api";
import { classLabel, money, performanceTone, type PerformanceClassification } from "./studentProfileUtils";

type StickyHeaderProps = {
  student: StudentDetail;
  attendancePercentage: number;
  currentRank: number | null;
  feeBalance: number;
  totalAbsentThisMonth: number;
  performanceRate: number | null;
  performanceClassification: PerformanceClassification;
  isPerformanceFallback: boolean;
  canViewAcademic: boolean;
  canViewAttendance: boolean;
  canViewFees: boolean;
};

type PillTone = "good" | "warn" | "danger" | "neutral";

/* ── Status helpers ── */

function attendanceStatus(percentage: number): { label: string; tone: PillTone } {
  if (percentage >= 85) return { label: "Attendance: Strong", tone: "good" };
  if (percentage >= 75) return { label: "Attendance: Watch", tone: "warn" };
  return { label: "Attendance: Low", tone: "danger" };
}

function academicStatus(classification: PerformanceClassification): { label: string; tone: PillTone } {
  return { label: `Academic: ${classification}`, tone: performanceTone(classification) };
}

function feesStatus(feeBalance: number): { label: string; tone: PillTone } {
  if (feeBalance <= 0) return { label: "Fees: Clear", tone: "good" };
  return { label: "Fees: Pending", tone: "warn" };
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StudentAvatar({ student, className }: { student: StudentDetail; className?: string }) {
  const baseClass = className ?? "h-12 w-12";
  return (
    <div className={`${baseClass} shrink-0 overflow-hidden rounded-[6px] border border-[#DCE1E8] bg-[#EAF3FB] text-[#0F2557]`}>
      {student.profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={student.fullName} className="h-full w-full object-cover" src={student.profilePhotoUrl} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[16px] font-bold">{initials(student.fullName)}</div>
      )}
    </div>
  );
}

/* ── Tone-styled KPI mini-cards (matching KpiCard aesthetics) ── */

type KpiTone = "good" | "warn" | "danger" | "neutral";

const kpiToneStyles: Record<KpiTone, { hover: string; accent: string; iconBg: string }> = {
  neutral: { hover: "hover:border-[#8C96A3]", accent: "text-[#5A6573]", iconBg: "bg-[#F2F5F8]" },
  good: { hover: "hover:border-[#0F8A4A]", accent: "text-[#0F8A4A]", iconBg: "bg-[#E1F5EA]" },
  warn: { hover: "hover:border-[#B95A00]", accent: "text-[#B95A00]", iconBg: "bg-[#FFF2DC]" },
  danger: { hover: "hover:border-[#C8242C]", accent: "text-[#C8242C]", iconBg: "bg-[#FCE3E5]" },
};

function MiniKpiCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: KpiTone }) {
  const s = kpiToneStyles[tone];
  return (
    <div className={`flex min-h-[96px] items-center gap-3 rounded-[6px] border border-[#E2E7EE] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,20,25,0.04)] transition-colors duration-200 sm:h-[112px] sm:gap-4 sm:px-5 sm:py-4 ${s.hover}`}>
      <div className={`hidden h-14 w-14 shrink-0 items-center justify-center rounded-[8px] sm:flex ${s.iconBg}`}>
        <KpiIcon label={label} className={`h-6 w-6 ${s.accent}`} />
      </div>
      <div className="min-w-0 flex-1">
        <MarqueeText text={label} className="text-[15px] font-medium leading-6 text-[#52687D]" />
        <MarqueeText text={value} className="mt-0.5 text-[27px] font-semibold leading-8 tracking-normal text-[#0F2233]" />
      </div>
    </div>
  );
}

/* ── Squarish status tags ── */

const tagStyles: Record<PillTone, string> = {
  good:    "bg-[#22a74c]/[0.10] text-[#187d37] border-[#22a74c]/20",
  warn:    "bg-[#ff9500]/[0.10] text-[#b86400] border-[#ff9500]/20",
  danger:  "bg-[#d63230]/[0.10] text-[#b02725] border-[#d63230]/20",
  neutral: "bg-[rgba(0,0,0,0.04)] text-[#6e6e73] border-transparent",
};

function StatusTag({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide transition-all duration-200 ${tagStyles[tone]}`}>
      {label}
    </span>
  );
}

/* ── SVG Icons for buttons ── */

function PhoneIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M8 7h8M8 12h8M8 17h5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98" />
      <path d="m15.41 6.51-6.82 3.98" />
    </svg>
  );
}

function MoreVerticalIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/* ── Main Header ── */

export function StickyHeader({
  student,
  attendancePercentage,
  currentRank,
  feeBalance,
  performanceRate,
  performanceClassification,
  isPerformanceFallback,
  canViewAcademic,
  canViewAttendance,
  canViewFees
}: StickyHeaderProps) {
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const academic = academicStatus(performanceClassification);
  const attendance = attendanceStatus(attendancePercentage);
  const fees = feesStatus(feeBalance);

  /* KPI tones */
  const attendanceTone: KpiTone = attendancePercentage >= 85 ? "good" : attendancePercentage >= 75 ? "warn" : "danger";
  const feeTone: KpiTone = feeBalance <= 0 ? "good" : "warn";
  const performanceKpiTone = performanceTone(performanceClassification) as KpiTone;
  const performanceValue = performanceRate === null ? "No data" : `${performanceRate}%`;
  const canContactParent = student.access?.role === "PRINCIPAL" || student.access?.role === "ADMIN" || student.access?.role === "TEACHER";
  const canEditStudent = student.access?.role === "PRINCIPAL" || student.access?.role === "ADMIN";
  const parentShareMessage = encodeURIComponent(
    `SmartShala profile update for ${student.fullName}: attendance ${attendancePercentage}%, academic ${performanceClassification}, fee balance ${money(feeBalance)}.`
  );
  const actionButtonClass =
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[#DCE1E8] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#1d1d1f] transition-all duration-200 hover:bg-[#F7F8FB]";
  const mobileMenuItemClass =
    "flex w-full items-center gap-2 rounded-[6px] border border-[#DCE1E8] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#F7F8FB]";
  const mobileActionsMenu = (
    <div className="absolute left-1/2 top-[calc(100%+6px)] z-30 w-[min(210px,calc(100vw-48px))] -translate-x-1/2 space-y-1 overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white p-1.5 shadow-[0_16px_38px_-16px_rgba(15,20,25,0.42)]">
      {canEditStudent ? (
        <Link className="flex items-center gap-2 rounded-[6px] bg-[#0071e3] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#005bb5]" href={`/students/${student.id}/edit`} onClick={() => setMobileActionsOpen(false)}>
          <EditIcon /> Edit
        </Link>
      ) : null}
      {canContactParent ? (
        <>
          <a className={mobileMenuItemClass} href={`tel:${student.parentPhone}`} onClick={() => setMobileActionsOpen(false)}>
            <PhoneIcon /> Call parent
          </a>
          <a className="flex items-center gap-2 rounded-[6px] bg-[#25d366] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#20bd5a]" href={whatsappLink(student.parentPhone)} rel="noreferrer" target="_blank" onClick={() => setMobileActionsOpen(false)}>
            <WhatsAppIcon /> WhatsApp
          </a>
          <a className={mobileMenuItemClass} href={`${whatsappLink(student.parentPhone)}?text=${parentShareMessage}`} rel="noreferrer" target="_blank" onClick={() => setMobileActionsOpen(false)}>
            <ShareIcon /> Share
          </a>
        </>
      ) : null}
      <button className={mobileMenuItemClass} onClick={() => { setMobileActionsOpen(false); window.print(); }} type="button">
        <PrintIcon /> Print profile
      </button>
      <button className={mobileMenuItemClass} onClick={async () => {
        setMobileActionsOpen(false);
        try {
          await studentsApi.downloadReportCardPdf(student.id, student.fullName);
        } catch (err) {
          alert(err instanceof Error ? err.message : "Failed to download report card");
        }
      }} type="button">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Report card
      </button>
      {canViewFees ? (
        <Link className={mobileMenuItemClass} href={`/fees/${student.id}`} onClick={() => setMobileActionsOpen(false)}>
          <LedgerIcon /> Fee ledger
        </Link>
      ) : null}
    </div>
  );

  return (
    <div className="py-1.5">
      <section className="overflow-visible rounded-[6px] border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
        {/* ── Top row: Identity + Tags + Actions ── */}
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: avatar, name, meta, status tags */}
          <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4 lg:flex-1">
            <StudentAvatar student={student} className="hidden h-12 w-12 sm:block" />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[18px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[22px]">{student.fullName}</h1>
                <div className="relative shrink-0 md:hidden">
                  <button
                    aria-expanded={mobileActionsOpen}
                    aria-label="Student actions"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#DCE1E8] bg-white text-[#2A3340] transition-colors hover:bg-[#F7F8FB]"
                    onClick={() => setMobileActionsOpen((open) => !open)}
                    type="button"
                  >
                    <MoreVerticalIcon />
                  </button>
                  {mobileActionsOpen ? mobileActionsMenu : null}
                </div>
                <span className="hidden sm:inline text-[12px] font-medium text-[#86868b]">
                  {classLabel(student)} · <span className="type-code">{student.admissionNumber}</span>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-[6px]">
                {canViewAcademic ? <StatusTag label={academic.label} tone={academic.tone} /> : null}
                {canViewAttendance ? <StatusTag label={attendance.label} tone={attendance.tone} /> : null}
                {canViewFees ? <StatusTag label={fees.label} tone={fees.tone} /> : null}
              </div>
            </div>

            <StudentAvatar student={student} className="h-14 w-14 sm:hidden" />
          </div>

          {/* Right: Action buttons */}
          <div className="hidden flex-wrap items-center justify-end gap-2 md:flex lg:shrink-0">
            {canEditStudent ? (
              <Link
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#0071e3] px-3.5 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-[#005bb5]"
                href={`/students/${student.id}/edit`}
              >
                <EditIcon />
                Edit
              </Link>
            ) : null}
            {canContactParent ? (
              <>
                <a
                  className={actionButtonClass}
                  href={`tel:${student.parentPhone}`}
                >
                  <PhoneIcon />
                  Call parent
                </a>
                <a
                  className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#25d366] px-3.5 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-[#20bd5a]"
                  href={whatsappLink(student.parentPhone)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <WhatsAppIcon />
                  WhatsApp
                </a>
                <a
                  className={actionButtonClass}
                  href={`${whatsappLink(student.parentPhone)}?text=${parentShareMessage}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ShareIcon />
                  Share
                </a>
              </>
            ) : null}
            <button
              className={actionButtonClass}
              onClick={() => window.print()}
              type="button"
            >
              <PrintIcon />
              Print profile
            </button>
            <button
              className={actionButtonClass}
              onClick={async () => {
                try {
                  await studentsApi.downloadReportCardPdf(student.id, student.fullName);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Failed to download report card");
                }
              }}
              type="button"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Report card
            </button>
            {canViewFees ? (
              <Link
                className={actionButtonClass}
                href={`/fees/${student.id}`}
              >
                <LedgerIcon />
                Fee ledger
              </Link>
            ) : null}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 border-t border-[#E7EBF0] sm:mx-5" />

        {/* ── Bottom row: KPI mini-cards ── */}
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
          {canViewAttendance ? <MiniKpiCard label="Attendance %" value={`${attendancePercentage}%`} tone={attendanceTone} /> : null}
          {canViewAcademic ? <MiniKpiCard label="Current rank" value={currentRank ? `#${currentRank}` : "Not ranked"} tone="neutral" /> : null}
          {canViewFees ? <MiniKpiCard label="Fee balance" value={money(feeBalance)} tone={feeTone} /> : null}
          {canViewAcademic ? <MiniKpiCard label="Overall performance" value={performanceValue} tone={performanceKpiTone} /> : null}
        </div>
      </section>
    </div>
  );
}
