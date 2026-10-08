import { randomInt } from "node:crypto";
import type { CrmRole } from "../../../node_modules/@smartshala/master-client/index.js";
import { logger } from "../../config/logger.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";

/** Whoever is acting in the CRM. The super admin signs in as an admin with no user row. */
export type CrmActor = { id: string | null; name: string; role: CrmRole };

export const SYSTEM_NAME = "System";

/** LD-000123: what a salesperson reads out on a call. */
export function leadCode(number: number) {
  return `LD-${String(number).padStart(6, "0")}`;
}

/** For the timeline and WhatsApp messages; the PDFs keep "Rs." because their font has no ₹. */
export function rupees(minor: number) {
  return `₹${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** One line on the lead's timeline. Never allowed to fail the action it describes. */
export async function addActivity(leadId: string, type: string, message: string, actor: string) {
  await masterPrisma.leadActivity
    .create({ data: { leadId, type, message, actor } })
    .catch((err) => logger.error({ err, leadId, type }, "Failed to record lead activity"));
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Readable over the phone: no 0/O or 1/l/I to confuse. */
export function temporaryPassword(length = 10) {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(0, PASSWORD_ALPHABET.length)]).join("");
}
