import Link from "next/link";
import type { StudentDetail } from "@/lib/api";
import { classLabel, money, performanceTone, type PerformanceClassification } from "./studentProfileUtils";

type StickyHeaderProps = {
  student: StudentDetail;
  attendancePercentage: number;
  currentRank: number | null;
  feeBalance: number;
  daysSinceLastAbsent: number | null;
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

function formatDaysSinceLastAbsent(days: number | null) {
  if (days === null) return "No absences";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

/* ── Tone-styled KPI mini-cards (matching KpiCard aesthetics) ── */

type KpiTone = "good" | "warn" | "danger" | "neutral";

const kpiToneStyles: Record<KpiTone, { bg: string; border: string; value: string; bar: string }> = {
  neutral: { bg: "from-[#f5f5f7]/80 to-white/40", border: "border-[#e5e5ea]", value: "text-[#1d1d1f]", bar: "from-[#d2d2d7] to-[#aeaeb2]" },
  good:    { bg: "from-[#34c759]/20 to-[#34c759]/5", border: "border-[#34c759]/20", value: "text-[#248a3d]", bar: "from-[#34c759] to-[#248a3d]" },
  warn:    { bg: "from-[#ff9500]/20 to-[#ff9500]/5", border: "border-[#ff9500]/20", value: "text-[#cc7700]", bar: "from-[#ff9500] to-[#cc7700]" },
  danger:  { bg: "from-[#ff3b30]/20 to-[#ff3b30]/5", border: "border-[#ff3b30]/20", value: "text-[#c90011]", bar: "from-[#ff3b30] to-[#c90011]" },
};

function MiniKpiCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: KpiTone }) {
  const s = kpiToneStyles[tone];
  return (
    <div className={`relative overflow-hidden rounded-[10px] border bg-gradient-to-br pl-[18px] pr-3 py-2.5 ${s.border} ${s.bg}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b ${s.bar}`} />
      <p className={`text-[20px] font-bold leading-tight tracking-tight ${s.value}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[#1d1d1f]/60">{label}</p>
    </div>
  );
}

/* ── Squarish status tags ── */

const tagStyles: Record<PillTone, string> = {
  good:    "bg-[#34c759]/[0.10] text-[#248a3d] border-[#34c759]/20",
  warn:    "bg-[#ff9500]/[0.10] text-[#c93400] border-[#ff9500]/20",
  danger:  "bg-[#ff3b30]/[0.10] text-[#d70015] border-[#ff3b30]/20",
  neutral: "bg-[rgba(0,0,0,0.04)] text-[#6e6e73] border-transparent",
};

function StatusTag({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-all duration-200 ${tagStyles[tone]}`}>
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

/* ── Main Header ── */

export function StickyHeader({
  student,
  attendancePercentage,
  currentRank,
  feeBalance,
  daysSinceLastAbsent,
  performanceRate,
  performanceClassification,
  isPerformanceFallback,
  canViewAcademic,
  canViewAttendance,
  canViewFees
}: StickyHeaderProps) {
  const academic = academicStatus(performanceClassification);
  const attendance = attendanceStatus(attendancePercentage);
  const fees = feesStatus(feeBalance);

  /* KPI tones */
  const attendanceTone: KpiTone = attendancePercentage >= 85 ? "good" : attendancePercentage >= 75 ? "warn" : "danger";
  const feeTone: KpiTone = feeBalance <= 0 ? "good" : "warn";
  const absentTone: KpiTone = daysSinceLastAbsent === null ? "good" : daysSinceLastAbsent <= 2 ? "danger" : "neutral";
  const canContactParent = student.access?.role === "PRINCIPAL" || student.access?.role === "ADMIN" || student.access?.role === "TEACHER";

  return (
    <div className="py-1.5">
      <section className="overflow-hidden rounded-[14px] border border-white/60 bg-white/70 shadow-[0_2px_20px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
        {/* ── Top row: Identity + Tags + Actions ── */}
        <div className="flex flex-col gap-3 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: name, meta, performance badge */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Performance badge */}
            <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#0071e3]/15 bg-gradient-to-br from-[#0071e3]/10 to-[#34c759]/8 shadow-sm">
              <span className="text-[16px] font-bold leading-none tracking-tight text-[#1d1d1f]">
                {performanceRate === null ? "--" : `${performanceRate}%`}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[20px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[22px]">{student.fullName}</h1>
                <span className="hidden sm:inline text-[12px] font-medium text-[#86868b]">
                  {classLabel(student)} · {student.admissionNumber}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {canViewAcademic ? <StatusTag label={academic.label} tone={academic.tone} /> : null}
                {canViewAttendance ? <StatusTag label={attendance.label} tone={attendance.tone} /> : null}
                {canViewFees ? <StatusTag label={fees.label} tone={fees.tone} /> : null}
              </div>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canContactParent ? (
              <>
                <a
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-[#f5f5f7] px-3.5 py-2 text-[12px] font-semibold text-[#1d1d1f] transition-all duration-200 hover:bg-[#e8e8ed]"
                  href={`tel:${student.parentPhone}`}
                >
                  <PhoneIcon />
                  Call parent
                </a>
                <a
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3.5 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:bg-[#20bd5a]"
                  href={whatsappLink(student.parentPhone)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <WhatsAppIcon />
                  WhatsApp
                </a>
              </>
            ) : null}
            {canViewFees ? (
              <Link
                className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-[#f5f5f7] px-3.5 py-2 text-[12px] font-semibold text-[#1d1d1f] transition-all duration-200 hover:bg-[#e8e8ed]"
                href={`/fees/${student.id}`}
              >
                <LedgerIcon />
                Fee ledger
              </Link>
            ) : null}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-5 border-t border-[rgba(0,0,0,0.05)]" />

        {/* ── Bottom row: KPI mini-cards ── */}
        <div className="grid grid-cols-2 gap-2.5 px-5 py-3 lg:grid-cols-4">
          {canViewAttendance ? <MiniKpiCard label="Attendance %" value={`${attendancePercentage}%`} tone={attendanceTone} /> : null}
          {canViewAcademic ? <MiniKpiCard label="Current rank" value={currentRank ? `#${currentRank}` : "Not ranked"} tone="neutral" /> : null}
          {canViewFees ? <MiniKpiCard label="Fee balance" value={money(feeBalance)} tone={feeTone} /> : null}
          {canViewAttendance ? <MiniKpiCard label="Days since absent" value={formatDaysSinceLastAbsent(daysSinceLastAbsent)} tone={absentTone} /> : null}
        </div>
      </section>
    </div>
  );
}
