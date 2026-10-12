import type { Tone } from "../../super-admin/_lib/format";
import type { CustomStage, LeadPayment, LeadStage, OnboardingStatus } from "./types";

/** In pipeline order — the order the stage filters are shown in. Custom stages take CUSTOM's place. */
export const STAGE: Record<LeadStage, { label: string; tone: Tone }> = {
  NEW: { label: "Inbound", tone: "info" },
  CALL_NOT_CONNECTED: { label: "Call not connected", tone: "neutral" },
  CALLBACK_REQUESTED: { label: "Call back Requested", tone: "info" },
  DEMO_ARRANGED: { label: "Demo Arranged", tone: "info" },
  DEMO_SHOWN: { label: "Demo shown", tone: "info" },
  CUSTOM: { label: "Custom", tone: "neutral" },
  PROFORMA_SENT: { label: "Proforma sent", tone: "warn" },
  PAID: { label: "Deal closed", tone: "good" },
  ONBOARDED: { label: "Onboarded", tone: "good" },
  COLD: { label: "Cold Lead (without Demo)", tone: "neutral" },
  IRRELEVANT: { label: "Irrelevant Lead", tone: "neutral" },
  LOST: { label: "Missed Sales", tone: "danger" }
};

/**
 * A board column or stage choice. Its id is a built-in stage, or a custom
 * stage's own id.
 */
export type StageOption = { id: string; label: string; tone: Tone };

export function stageOptions(custom: CustomStage[] = []): StageOption[] {
  return (Object.keys(STAGE) as LeadStage[]).flatMap((id) =>
    id === "CUSTOM" ? custom.map((stage) => ({ id: stage.id, label: stage.name, tone: STAGE.CUSTOM.tone })) : [{ id, ...STAGE[id] }]
  );
}

/** The column a deal sits in. */
export function stageOf(deal: { stage: LeadStage; customStageId: string | null }) {
  return deal.stage === "CUSTOM" && deal.customStageId ? deal.customStageId : deal.stage;
}

export function stageLabel(deal: { stage: LeadStage; customStage: { name: string } | null }) {
  return deal.stage === "CUSTOM" && deal.customStage ? deal.customStage.name : STAGE[deal.stage].label;
}

/** What to send to move a deal to a column. */
export function stageBody(id: string) {
  return id in STAGE ? { stage: id } : { stage: "CUSTOM", customStageId: id };
}

/** The coloured dot beside a stage name — on board columns and the deal header. */
export const STAGE_DOT: Record<Tone, string> = {
  info: "bg-blue-500",
  neutral: "bg-slate-400",
  warn: "bg-amber-500",
  good: "bg-green-500",
  danger: "bg-red-500"
};

const AUTOMATIC_STAGES: string[] = ["PROFORMA_SENT", "PAID", "ONBOARDED"];

/**
 * Mirrors updateLead on the server: people move a deal between every stage
 * but Proforma sent, Deal closed and Onboarded (and out of Proforma sent);
 * payment links and payment move it into those. Takes stageOf ids.
 */
export function canMoveTo(from: string, to: string) {
  const manual = (id: string) => !AUTOMATIC_STAGES.includes(id);
  return from !== to && manual(to) && (manual(from) || from === "PROFORMA_SENT");
}

export const ONBOARDING: Record<OnboardingStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Waiting for payment", tone: "neutral" },
  RUNNING: { label: "Setting up the school…", tone: "info" },
  DONE: { label: "School is live", tone: "good" },
  FAILED: { label: "Setup failed", tone: "danger" }
};

export const PAYMENT_STATUS: Record<LeadPayment["status"], { label: string; tone: Tone }> = {
  CREATED: { label: "Started", tone: "neutral" },
  AUTHORIZED: { label: "Authorised", tone: "info" },
  CAPTURED: { label: "Approved", tone: "good" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "warn" }
};

/** ₹93K, ₹1.2L — for the summary cards, where the exact paisa does not matter. */
export function compactRupees(minor: number) {
  const rupees = minor / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * A wa.me link that opens WhatsApp on the salesperson's phone or desktop with
 * the message typed out. A bare 10-digit number is taken to be Indian.
 */
export function whatsappUrl(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** GST state codes, as the first two digits of a GSTIN and the "Place of Supply" on an invoice. */
export const GST_STATES: Array<{ code: string; name: string }> = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" }
];
