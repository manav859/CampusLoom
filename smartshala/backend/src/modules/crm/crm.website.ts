import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { CrmRole } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../core/errors.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";
import { createWebsiteLead } from "./crm.service.js";
import { shortDate } from "./crm.shared.js";
import type { WebsiteLeadInput } from "./crm.schemas.js";

/**
 * The marketing site posts every demo request here, server to server, with a
 * shared token. The site still emails the lead as a backup, so this endpoint
 * only has to be quick and never lose one: a school that enquired twice lands
 * on the deal it already has instead of becoming a second one.
 */

/** Same length either way, so the comparison tells nothing from how long it took. */
function sameSecret(provided: string, expected: string) {
  const left = createHash("sha256").update(provided).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function requireWebsiteToken(req: Request, _res: Response, next: NextFunction) {
  const expected = env.WEBSITE_LEAD_TOKEN;
  const provided = (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!expected) {
    // Fail closed, and say so in the log rather than in the answer.
    logger.error("A website lead was posted but WEBSITE_LEAD_TOKEN is not set");
    throw new AppError(401, "Not authorised", "WEBSITE_TOKEN_INVALID");
  }
  if (!provided || !sameSecret(provided, expected)) {
    throw new AppError(401, "Not authorised", "WEBSITE_TOKEN_INVALID");
  }

  next();
}

/** "+919876543210" is the same school as "9876543210", which is what the CRM stores. */
function indianPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits || raw.trim();
}

/**
 * The active salesperson who has waited longest for a lead, which is
 * round-robin without a cursor to keep: somebody who has never had one goes
 * first, and the order repairs itself when the team changes.
 */
async function nextInTurn() {
  const team = await masterPrisma.crmUser.findMany({
    where: { isActive: true, role: CrmRole.SALES },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true }
  });
  if (team.length === 0) return null;

  const latest = await masterPrisma.lead.groupBy({ by: ["assignedToId"], _max: { createdAt: true } });
  const lastGot = new Map(latest.map((row) => [row.assignedToId, row._max.createdAt?.getTime() ?? 0]));
  const waitedLongest = (member: { id: string }) => lastGot.get(member.id) ?? 0;

  return team.reduce((best, member) => (waitedLongest(member) < waitedLongest(best) ? member : best)).id;
}

/** What the salesperson reads on the timeline: where the enquiry came from. */
function enquiryDetails(input: WebsiteLeadInput) {
  const lines = [
    input.page ? `Page: ${input.page}` : null,
    input.role ? `Role: ${input.role}` : null,
    input.numberOfStudents ? `Students: ${input.numberOfStudents.toLocaleString("en-IN")}` : null,
    input.email ? null : "Email: not given",
    ...Object.entries(input.utm ?? {}).map(([key, value]) => (value ? `${key}: ${value}` : null)),
    input.submittedAt ? `Submitted: ${shortDate(new Date(input.submittedAt))}` : null
  ];
  return lines.filter(Boolean).join("\n");
}

export async function receiveWebsiteLead(input: WebsiteLeadInput) {
  return createWebsiteLead(
    {
      schoolName: input.schoolName,
      ownerName: input.name,
      email: input.email ?? "",
      phone: indianPhone(input.phone),
      numberOfStudents: input.numberOfStudents ?? null
    },
    { details: enquiryDetails(input), assignedToId: await nextInTurn() }
  );
}
