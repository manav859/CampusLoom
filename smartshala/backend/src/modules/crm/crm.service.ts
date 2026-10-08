import bcrypt from "bcryptjs";
import {
  CrmRole,
  LeadSource,
  LeadStage,
  OnboardingStatus,
  PaymentLinkStatus,
  PaymentState,
  Prisma,
  ProformaStatus,
  TenantDeletionStatus
} from "../../../node_modules/@smartshala/master-client/index.js";
import type { Lead } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { addDays, minorFromRupees, quotePlan } from "../billing/billing.pricing.js";
import { getPlanByCodeOrThrow, listPlans, renderInvoicePdf, sellerForPdf } from "../billing/billing.service.js";
import { generateInvoicePdf } from "../billing/invoice-pdf.js";
import { createProformaPaymentLink, paymentLinkUrl, revokePaymentLink } from "../billing/paymentLinks.service.js";
import { startOnboarding } from "./crm.conversion.js";
import { addActivity, leadCode, rupees, shortDate, SYSTEM_NAME, type CrmActor } from "./crm.shared.js";

/** A proforma stays payable this long unless the salesperson says otherwise. */
const PROFORMA_VALID_DAYS = 15;

/** Stages a person moves a lead between. The rest are set by what happens to it. */
const MANUAL_STAGES: LeadStage[] = [LeadStage.NEW, LeadStage.CONTACTED, LeadStage.LOST];

const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  PROFORMA_SENT: "Proforma sent",
  PAID: "Paid",
  ONBOARDED: "Onboarded",
  LOST: "Lost"
};

function assertMaster() {
  if (!isMasterDbConfigured()) {
    throw new AppError(503, "The CRM is unavailable because the master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }
}

/** A salesperson sees only the leads assigned to them; an admin sees all of them. */
function leadScope(actor: CrmActor): Prisma.LeadWhereInput {
  return actor.role === CrmRole.ADMIN ? {} : { assignedToId: actor.id };
}

async function leadForActor(actor: CrmActor, leadId: string) {
  assertMaster();
  const lead = await masterPrisma.lead.findFirst({ where: { id: leadId, ...leadScope(actor) } });
  if (!lead) throw new AppError(404, "Deal not found", "LEAD_NOT_FOUND");
  return lead;
}

async function proformaForActor(actor: CrmActor, proformaId: string) {
  assertMaster();
  const proforma = await masterPrisma.proforma.findFirst({
    where: { id: proformaId, lead: leadScope(actor) },
    include: { lead: true, plan: true }
  });
  if (!proforma) throw new AppError(404, "Proforma not found", "PROFORMA_NOT_FOUND");
  return proforma;
}

async function assertAssignable(userId: string) {
  const user = await masterPrisma.crmUser.findUnique({ where: { id: userId } });
  if (!user?.isActive) throw new AppError(400, "That salesperson is not active", "CRM_USER_INACTIVE");
  return user;
}

// --- Team --------------------------------------------------------------------

const teamSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { leads: true } }
} as const;

export async function listTeam() {
  assertMaster();
  const users = await masterPrisma.crmUser.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: teamSelect });
  return users.map(({ _count, ...user }) => ({ ...user, leadCount: _count.leads }));
}

export async function createTeamMember(input: { name: string; email: string; phone?: string; role: CrmRole; password: string }) {
  assertMaster();
  const email = input.email.trim().toLowerCase();
  if (env.SUPER_ADMIN_EMAIL && email === env.SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new AppError(409, "That email belongs to the super admin", "CRM_USER_EMAIL_TAKEN");
  }
  try {
    const { _count, ...user } = await masterPrisma.crmUser.create({
      data: {
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, 10)
      },
      select: teamSelect
    });
    return { ...user, leadCount: _count.leads };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "Someone on the team already uses that email", "CRM_USER_EMAIL_TAKEN");
    }
    throw error;
  }
}

export async function updateTeamMember(
  actor: CrmActor,
  userId: string,
  input: { name?: string; phone?: string | null; role?: CrmRole; isActive?: boolean; password?: string }
) {
  assertMaster();
  if (actor.id === userId && (input.isActive === false || (input.role && input.role !== CrmRole.ADMIN))) {
    throw new AppError(409, "You cannot deactivate yourself or remove your own admin role", "CRM_SELF_LOCKOUT");
  }
  const existing = await masterPrisma.crmUser.findUnique({ where: { id: userId } });
  if (!existing) throw new AppError(404, "Team member not found", "CRM_USER_NOT_FOUND");

  const { _count, ...user } = await masterPrisma.crmUser.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {})
    },
    select: teamSelect
  });
  return { ...user, leadCount: _count.leads };
}

// --- Leads -------------------------------------------------------------------

export type LeadInput = {
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
  address?: string | null;
  gstin?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
  numberOfStudents?: number | null;
  numberOfStaff?: number | null;
};

/** Trimmed, lower-cased email, upper-cased GSTIN — and the state read off the GSTIN when none was picked. */
function cleanLeadInput<T extends Partial<LeadInput>>(input: T): T {
  const gstin = input.gstin === undefined ? undefined : input.gstin?.trim().toUpperCase() || null;
  return {
    ...input,
    ...(input.schoolName !== undefined ? { schoolName: input.schoolName.trim() } : {}),
    ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
    ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
    ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
    ...(gstin !== undefined ? { gstin } : {}),
    ...(gstin && !input.stateCode ? { stateCode: gstin.slice(0, 2) } : {})
  };
}

/** An open lead with this phone or email — the same school asked twice, or two salespeople chasing it. */
async function findOpenDuplicate(input: { phone: string; email: string }, exceptId?: string) {
  // A Meta form may leave one of them out; a blank never matches another blank.
  const match = [input.phone ? { phone: input.phone } : null, input.email ? { email: input.email } : null].filter((m) => m !== null);
  if (match.length === 0) return null;
  return masterPrisma.lead.findFirst({
    where: {
      stage: { notIn: [LeadStage.LOST, LeadStage.ONBOARDED] },
      OR: match,
      ...(exceptId ? { id: { not: exceptId } } : {})
    },
    include: { assignedTo: { select: { name: true } } }
  });
}

function duplicateMessage(lead: Lead & { assignedTo: { name: string } | null }) {
  const owner = lead.assignedTo ? `, assigned to ${lead.assignedTo.name}` : ", not assigned yet";
  return `${leadCode(lead.number)} (${lead.schoolName}${owner}) already has this phone or email`;
}

export async function listLeads(actor: CrmActor, filters: { stage?: LeadStage; q?: string; assignedTo?: string }) {
  assertMaster();
  const scope = leadScope(actor);
  const text = filters.q?.trim();
  const leadNumber = text ? Number(text.replace(/^LD-?/i, "")) : NaN;

  const where: Prisma.LeadWhereInput = {
    ...scope,
    ...(actor.role === CrmRole.ADMIN && filters.assignedTo
      ? { assignedToId: filters.assignedTo === "unassigned" ? null : filters.assignedTo }
      : {}),
    ...(text
      ? {
          OR: [
            { schoolName: { contains: text, mode: "insensitive" } },
            { ownerName: { contains: text, mode: "insensitive" } },
            { email: { contains: text, mode: "insensitive" } },
            { phone: { contains: text } },
            { schoolId: text.toUpperCase() },
            ...(Number.isInteger(leadNumber) && leadNumber > 0 ? [{ number: leadNumber }] : [])
          ]
        }
      : {})
  };

  const [leads, byStage] = await Promise.all([
    masterPrisma.lead.findMany({
      where: { ...where, ...(filters.stage ? { stage: filters.stage } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        assignedTo: { select: { id: true, name: true } },
        proformas: {
          where: { status: { not: ProformaStatus.CANCELLED } },
          orderBy: { issuedAt: "desc" },
          take: 1,
          select: { number: true, totalMinor: true, status: true }
        }
      }
    }),
    masterPrisma.lead.groupBy({ by: ["stage"], where, _count: { _all: true } })
  ]);

  return {
    counts: Object.fromEntries(byStage.map((row) => [row.stage, row._count._all])) as Partial<Record<LeadStage, number>>,
    leads: leads.map(({ proformas, ...lead }) => ({ ...lead, code: leadCode(lead.number), proforma: proformas[0] ?? null }))
  };
}

export async function createLead(actor: CrmActor, raw: LeadInput & { assignedToId?: string | null }) {
  assertMaster();
  const input = cleanLeadInput(raw);

  const duplicate = await findOpenDuplicate(input);
  if (duplicate) throw new AppError(409, duplicateMessage(duplicate), "LEAD_DUPLICATE");

  const school = await masterPrisma.school.findFirst({
    where: { email: input.email, deletionStatus: { not: TenantDeletionStatus.DELETED } },
    select: { schoolId: true, schoolName: true }
  });
  if (school) {
    throw new AppError(409, `${school.schoolName} (${school.schoolId}) is already a SmartShala school with this email`, "LEAD_ALREADY_SCHOOL");
  }

  // A salesperson's leads are their own; an admin may hand one to anybody.
  const assignedToId = actor.role === CrmRole.ADMIN ? (input.assignedToId ?? null) : actor.id;
  if (assignedToId) await assertAssignable(assignedToId);

  const { assignedToId: _ignored, ...details } = input;
  const lead = await masterPrisma.lead.create({
    data: { ...details, assignedToId, source: LeadSource.CRM, createdBy: actor.name }
  });
  await addActivity(lead.id, "CREATED", "Deal created", actor.name);
  return { ...lead, code: leadCode(lead.number) };
}

/**
 * The public enquiry form. It never fails on a repeat — the school just asked
 * again, which the salesperson should see on the lead they already have.
 */
export async function createWebsiteLead(raw: LeadInput) {
  assertMaster();
  const input = cleanLeadInput(raw);

  const duplicate = await findOpenDuplicate(input);
  if (duplicate) {
    await addActivity(duplicate.id, "ENQUIRY", "Sent the website enquiry form again", SYSTEM_NAME);
    return { code: leadCode(duplicate.number) };
  }

  const lead = await masterPrisma.lead.create({
    data: { ...input, source: LeadSource.WEBSITE, createdBy: "Website" }
  });
  await addActivity(lead.id, "CREATED", "Enquiry received from the website", SYSTEM_NAME);
  return { code: leadCode(lead.number) };
}

/**
 * A lead from a Meta lead form. Like the website form, a repeat lands on the
 * deal that already exists instead of failing; `details` is what the form said.
 */
export async function createMetaLead(raw: LeadInput, details: string, assignedToId: string | null) {
  assertMaster();
  const input = cleanLeadInput(raw);

  const duplicate = await findOpenDuplicate(input);
  if (duplicate) {
    await addActivity(duplicate.id, "META_LEAD", `Filled a Meta lead form again\n${details}`, SYSTEM_NAME);
    return { leadId: duplicate.id, created: false };
  }

  const lead = await masterPrisma.lead.create({
    data: { ...input, assignedToId, source: LeadSource.META, createdBy: "Meta" }
  });
  await addActivity(lead.id, "CREATED", "Lead received from a Meta lead form", SYSTEM_NAME);
  await addActivity(lead.id, "META_LEAD", details, SYSTEM_NAME);
  return { leadId: lead.id, created: true };
}

export async function getLead(actor: CrmActor, leadId: string) {
  await leadForActor(actor, leadId);
  const lead = await masterPrisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 300 },
      proformas: {
        orderBy: { issuedAt: "desc" },
        include: {
          invoice: { select: { id: true, number: true, status: true } },
          paymentLinks: { orderBy: { createdAt: "desc" } },
          payments: { orderBy: { createdAt: "desc" } }
        }
      }
    }
  });

  const school = lead.schoolId
    ? await masterPrisma.school.findUnique({
        where: { schoolId: lead.schoolId },
        select: { schoolId: true, isActive: true, subscription: { select: { status: true, currentPeriodEnd: true } } }
      })
    : null;

  return {
    ...lead,
    code: leadCode(lead.number),
    school,
    proformas: lead.proformas.map((proforma) => ({
      ...proforma,
      paymentLinks: proforma.paymentLinks.map((link) => ({
        ...link,
        url: paymentLinkUrl(link.token),
        shareText: link.status === PaymentLinkStatus.ACTIVE ? paymentLinkMessage(lead, proforma, link) : null
      }))
    }))
  };
}

const CONTACT_FIELDS = [
  "schoolName",
  "ownerName",
  "email",
  "phone",
  "address",
  "gstin",
  "stateName",
  "stateCode",
  "numberOfStudents",
  "numberOfStaff"
] as const;

const FIELD_LABEL: Record<(typeof CONTACT_FIELDS)[number], string> = {
  schoolName: "school name",
  ownerName: "principal",
  email: "email",
  phone: "phone",
  address: "address",
  gstin: "GSTIN",
  stateName: "state",
  stateCode: "state",
  numberOfStudents: "students",
  numberOfStaff: "staff"
};

export async function updateLead(
  actor: CrmActor,
  leadId: string,
  raw: Partial<LeadInput> & { stage?: LeadStage; lostReason?: string | null; assignedToId?: string | null }
) {
  const lead = await leadForActor(actor, leadId);
  const input = cleanLeadInput(raw);
  const data: Prisma.LeadUncheckedUpdateInput = {};
  const notes: string[] = [];

  const changed = CONTACT_FIELDS.filter((field) => input[field] !== undefined && input[field] !== lead[field]);
  if (changed.length) {
    if (lead.stage === LeadStage.ONBOARDED) {
      throw new AppError(409, "This deal is a school now — change its details from the super admin panel", "LEAD_ONBOARDED");
    }
    const next = { phone: input.phone ?? lead.phone, email: input.email ?? lead.email };
    if (input.phone !== undefined || input.email !== undefined) {
      const duplicate = await findOpenDuplicate(next, lead.id);
      if (duplicate) throw new AppError(409, duplicateMessage(duplicate), "LEAD_DUPLICATE");
    }
    for (const field of changed) Object.assign(data, { [field]: input[field] });
    notes.push(`Updated ${[...new Set(changed.map((field) => FIELD_LABEL[field]))].join(", ")}`);
  }

  if (input.stage && input.stage !== lead.stage) {
    if (!MANUAL_STAGES.includes(input.stage) || !(MANUAL_STAGES.includes(lead.stage) || lead.stage === LeadStage.PROFORMA_SENT)) {
      throw new AppError(409, `A deal cannot be moved from ${STAGE_LABEL[lead.stage]} to ${STAGE_LABEL[input.stage]} by hand`, "LEAD_STAGE_LOCKED");
    }
    if (input.stage === LeadStage.LOST && !input.lostReason?.trim()) {
      throw new AppError(400, "Say why the deal was lost", "LEAD_LOST_REASON_REQUIRED");
    }
    data.stage = input.stage;
    data.lostAt = input.stage === LeadStage.LOST ? new Date() : null;
    data.lostReason = input.stage === LeadStage.LOST ? input.lostReason!.trim() : null;
    notes.push(
      `Stage: ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[input.stage]}${input.stage === LeadStage.LOST ? ` (${input.lostReason!.trim()})` : ""}`
    );
  }

  if (input.assignedToId !== undefined && input.assignedToId !== lead.assignedToId) {
    if (actor.role !== CrmRole.ADMIN) throw new AppError(403, "Only a sales admin can reassign a deal", "CRM_ADMIN_REQUIRED");
    const user = input.assignedToId ? await assertAssignable(input.assignedToId) : null;
    data.assignedToId = input.assignedToId;
    notes.push(user ? `Assigned to ${user.name}` : "Unassigned");
  }

  if (!notes.length) return getLead(actor, leadId);
  await masterPrisma.lead.update({ where: { id: lead.id }, data });
  for (const note of notes) await addActivity(lead.id, "UPDATED", note, actor.name);
  return getLead(actor, leadId);
}

export async function addNote(actor: CrmActor, leadId: string, text: string) {
  const lead = await leadForActor(actor, leadId);
  await addActivity(lead.id, "NOTE", text.trim(), actor.name);
  // A note is work on the lead: it should rise to the top of the list.
  await masterPrisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } });
  return getLead(actor, leadId);
}

export async function retryOnboarding(actor: CrmActor, leadId: string) {
  const lead = await leadForActor(actor, leadId);
  if (lead.onboardingStatus === OnboardingStatus.DONE) throw new AppError(409, "This school is already set up", "LEAD_ALREADY_ONBOARDED");
  const started = await startOnboarding(lead.id);
  if (!started) throw new AppError(409, "Setup is already running for this school, or the deal has not paid", "ONBOARDING_NOT_STARTED");
  await addActivity(lead.id, "ONBOARDING", "Setup retried", actor.name);
  return getLead(actor, leadId);
}

// --- Proformas ---------------------------------------------------------------

async function nextProformaNumber() {
  const [row] = await masterPrisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('proforma_number_seq')`;
  return `PI-${new Date().getFullYear()}-${String(row.nextval).padStart(6, "0")}`;
}

export async function issueProforma(
  actor: CrmActor,
  leadId: string,
  input: { planCode: string; priceRupees?: number; couponCode?: string; validDays?: number; notes?: string }
) {
  const lead = await leadForActor(actor, leadId);
  if (lead.stage === LeadStage.PAID || lead.stage === LeadStage.ONBOARDED) {
    throw new AppError(409, "This deal has already paid", "LEAD_ALREADY_PAID");
  }
  if (lead.stage === LeadStage.LOST) throw new AppError(409, "Reopen the deal before sending it a proforma", "LEAD_LOST");

  const plan = await getPlanByCodeOrThrow(input.planCode);
  if (!plan.isActive) throw new AppError(409, "That plan is no longer available", "PLAN_INACTIVE");

  const customPriceMinor = input.priceRupees !== undefined ? minorFromRupees(input.priceRupees) : null;
  if ((customPriceMinor ?? plan.priceMinor) <= 0) throw new AppError(400, "A proforma needs a price above zero", "PROFORMA_PRICE_REQUIRED");

  const quote = await quotePlan(plan, input.couponCode, { customPriceMinor });
  if (input.couponCode && !quote.couponValid) throw new AppError(400, quote.couponMessage, "INVALID_COUPON");

  const number = await nextProformaNumber();
  const now = new Date();

  // One proforma is live at a time: a revised quote replaces the old one and
  // kills its payment link, so the school cannot pay the superseded amount.
  const proforma = await masterPrisma.$transaction(async (tx) => {
    const open = await tx.proforma.findMany({ where: { leadId: lead.id, status: ProformaStatus.ISSUED }, select: { id: true } });
    if (open.length) {
      const ids = open.map((row) => row.id);
      await tx.proforma.updateMany({ where: { id: { in: ids } }, data: { status: ProformaStatus.CANCELLED, cancelledAt: now } });
      await tx.paymentLink.updateMany({
        where: { proformaId: { in: ids }, status: PaymentLinkStatus.ACTIVE },
        data: { status: PaymentLinkStatus.REVOKED, revokedAt: now }
      });
    }
    return tx.proforma.create({
      data: {
        number,
        leadId: lead.id,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        currency: quote.currency,
        listPriceMinor: plan.priceMinor,
        subtotalMinor: quote.subtotalMinor,
        discountMinor: quote.discountMinor,
        taxMinor: quote.taxMinor,
        totalMinor: quote.totalMinor,
        couponCode: quote.couponCode,
        notes: input.notes?.trim() || null,
        validUntil: addDays(now, input.validDays ?? PROFORMA_VALID_DAYS),
        createdBy: actor.name
      }
    });
  });

  const priceNote = quote.subtotalMinor !== plan.priceMinor ? ` at an agreed ${rupees(quote.subtotalMinor)} (list ${rupees(plan.priceMinor)})` : "";
  await addActivity(
    lead.id,
    "PROFORMA_ISSUED",
    `Proforma ${number} issued for ${plan.name}${priceNote}: ${rupees(quote.totalMinor)} incl. GST`,
    actor.name
  );
  return proforma;
}

export async function cancelProforma(actor: CrmActor, proformaId: string) {
  const proforma = await proformaForActor(actor, proformaId);
  if (proforma.status !== ProformaStatus.ISSUED) throw new AppError(409, "Only an unpaid proforma can be cancelled", "PROFORMA_NOT_OPEN");
  const now = new Date();
  await masterPrisma.$transaction([
    masterPrisma.proforma.update({ where: { id: proforma.id }, data: { status: ProformaStatus.CANCELLED, cancelledAt: now } }),
    masterPrisma.paymentLink.updateMany({
      where: { proformaId: proforma.id, status: PaymentLinkStatus.ACTIVE },
      data: { status: PaymentLinkStatus.REVOKED, revokedAt: now }
    })
  ]);
  await addActivity(proforma.leadId, "PROFORMA_CANCELLED", `Proforma ${proforma.number} cancelled; its payment link no longer works`, actor.name);
}

function termText(plan: { interval: string; intervalCount: number } | null) {
  if (!plan) return "From the date of payment";
  const unit = plan.interval === "MONTH" ? "month" : "year";
  return `${plan.intervalCount} ${unit}${plan.intervalCount === 1 ? "" : "s"} from the date of payment`;
}

const PROFORMA_STATUS_TEXT: Record<ProformaStatus, string> = {
  ISSUED: "UNPAID",
  PAID: "PAID",
  CANCELLED: "CANCELLED"
};

export async function renderProformaPdf(actor: CrmActor, proformaId: string) {
  const proforma = await proformaForActor(actor, proformaId);
  const { lead } = proforma;
  const buffer = await generateInvoicePdf({
    kind: "PROFORMA",
    seller: sellerForPdf(),
    school: {
      schoolId: leadCode(lead.number),
      schoolName: lead.schoolName,
      ownerName: lead.ownerName,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      gstin: lead.gstin,
      stateName: lead.stateName,
      stateCode: lead.stateCode
    },
    invoice: {
      number: proforma.number,
      status: PROFORMA_STATUS_TEXT[proforma.status],
      currency: proforma.currency,
      planName: proforma.planName,
      planCode: proforma.planCode,
      sacCode: env.BILLING_SAC_CODE,
      subtotalMinor: proforma.subtotalMinor,
      discountMinor: proforma.discountMinor,
      taxMinor: proforma.taxMinor,
      totalMinor: proforma.totalMinor,
      amountPaidMinor: proforma.amountPaidMinor,
      couponCode: proforma.couponCode,
      periodText: termText(proforma.plan),
      issuedAt: proforma.issuedAt,
      dueAt: proforma.validUntil,
      paidAt: proforma.paidAt,
      notes: proforma.notes
    },
    payments: []
  });
  return { buffer, number: proforma.number };
}

/** The tax invoice raised when a lead paid — only for a lead this person may see. */
export async function renderLeadInvoicePdf(actor: CrmActor, invoiceId: string) {
  assertMaster();
  const proforma = await masterPrisma.proforma.findFirst({ where: { invoiceId, lead: leadScope(actor) }, select: { id: true } });
  if (!proforma) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");
  return renderInvoicePdf(invoiceId);
}

// --- Payment links -----------------------------------------------------------

function paymentLinkMessage(
  lead: Pick<Lead, "ownerName" | "schoolName">,
  proforma: { number: string; planName: string; totalMinor: number; amountPaidMinor: number },
  link: { token: string; expiresAt: Date }
) {
  return [
    `Dear ${lead.ownerName},`,
    "",
    `Thank you for choosing SmartShala for ${lead.schoolName}.`,
    "",
    `Proforma: ${proforma.number}`,
    `Plan: ${proforma.planName}`,
    `Amount payable: ${rupees(proforma.totalMinor - proforma.amountPaidMinor)} (incl. GST)`,
    "",
    `Pay securely here: ${paymentLinkUrl(link.token)}`,
    `This link is valid until ${shortDate(link.expiresAt)}.`,
    "",
    `— ${env.BILLING_SELLER_NAME}`
  ].join("\n");
}

export async function createLeadPaymentLink(actor: CrmActor, proformaId: string, input: { expiresInDays?: number; note?: string }) {
  const proforma = await proformaForActor(actor, proformaId);
  if (proforma.status !== ProformaStatus.ISSUED) throw new AppError(409, "This proforma is not open for payment", "PROFORMA_NOT_OPEN");

  const link = await createProformaPaymentLink({
    proformaId: proforma.id,
    note: input.note?.trim() || null,
    expiresInDays: input.expiresInDays,
    createdBy: `CRM:${actor.name}`
  });

  const { lead } = proforma;
  if (lead.stage === LeadStage.NEW || lead.stage === LeadStage.CONTACTED) {
    await masterPrisma.lead.update({ where: { id: lead.id }, data: { stage: LeadStage.PROFORMA_SENT } });
  }
  await addActivity(lead.id, "LINK_CREATED", `Payment link for ${proforma.number} created, valid until ${shortDate(link.expiresAt)}`, actor.name);

  return { ...link, shareText: paymentLinkMessage(lead, proforma, link) };
}

async function leadLinkForActor(actor: CrmActor, linkId: string) {
  assertMaster();
  const link = await masterPrisma.paymentLink.findFirst({
    where: { id: linkId, proforma: { lead: leadScope(actor) } },
    include: { proforma: true }
  });
  if (!link?.proforma) throw new AppError(404, "Payment link not found", "PAYMENT_LINK_NOT_FOUND");
  return { ...link, proforma: link.proforma };
}

export async function revokeLeadPaymentLink(actor: CrmActor, linkId: string) {
  const link = await leadLinkForActor(actor, linkId);
  await revokePaymentLink(link.id, { kind: "CRM", label: actor.name });
  await addActivity(link.proforma.leadId, "LINK_REVOKED", `Payment link for ${link.proforma.number} revoked`, actor.name);
}

/** The salesperson opened WhatsApp with the link — worth a line on the timeline. */
export async function recordLinkShared(actor: CrmActor, linkId: string) {
  const link = await leadLinkForActor(actor, linkId);
  await addActivity(link.proforma.leadId, "LINK_SHARED", `Payment link for ${link.proforma.number} shared on WhatsApp`, actor.name);
}

// --- Plans & payments --------------------------------------------------------

export async function listSellablePlans() {
  const plans = await listPlans({ publicOnly: false });
  return plans.filter((plan) => plan.isActive && plan.priceMinor > 0);
}

/**
 * Money from the CRM — what new schools paid on their proformas — for a date
 * range, with the cards above the list: collected, how many payments, and the
 * value of the leads lost in the same range.
 */
export async function listCrmPayments(actor: CrmActor, filters: { from: Date; to: Date; q?: string }) {
  assertMaster();
  const range = { gte: filters.from, lt: filters.to };
  const scope = leadScope(actor);
  const text = filters.q?.trim();
  const leadWhere: Prisma.LeadWhereInput = text
    ? {
        ...scope,
        OR: [
          { schoolName: { contains: text, mode: "insensitive" } },
          { ownerName: { contains: text, mode: "insensitive" } },
          { phone: { contains: text } },
          { schoolId: text.toUpperCase() }
        ]
      }
    : scope;

  const collectedWhere: Prisma.PaymentWhereInput = {
    proforma: { lead: scope },
    status: { in: [PaymentState.CAPTURED, PaymentState.REFUNDED] },
    capturedAt: range
  };

  const [payments, collected, lost] = await Promise.all([
    masterPrisma.payment.findMany({
      where: {
        proforma: { lead: leadWhere },
        OR: [
          { status: { in: [PaymentState.CAPTURED, PaymentState.REFUNDED] }, capturedAt: range },
          { status: PaymentState.FAILED, createdAt: range }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        invoice: { select: { id: true, number: true } },
        proforma: { include: { lead: { include: { assignedTo: { select: { id: true, name: true } } } } } }
      }
    }),
    masterPrisma.payment.aggregate({ where: collectedWhere, _sum: { amountMinor: true, refundedMinor: true }, _count: { _all: true } }),
    masterPrisma.lead.findMany({
      where: { ...scope, stage: LeadStage.LOST, lostAt: range },
      select: { proformas: { orderBy: { issuedAt: "desc" }, take: 1, select: { totalMinor: true } } }
    })
  ]);

  return {
    summary: {
      collectedMinor: (collected._sum.amountMinor ?? 0) - (collected._sum.refundedMinor ?? 0),
      paymentsCount: collected._count._all,
      lostMinor: lost.reduce((sum, lead) => sum + (lead.proformas[0]?.totalMinor ?? 0), 0),
      lostLeads: lost.length
    },
    payments: payments.map(({ proforma, invoice, ...payment }) => {
      const { lead, ...bill } = proforma!;
      return {
        id: payment.id,
        status: payment.status,
        amountMinor: payment.amountMinor,
        refundedMinor: payment.refundedMinor,
        currency: payment.currency,
        method: payment.method,
        gatewayMode: payment.gatewayMode,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
        failureReason: payment.failureReason,
        capturedAt: payment.capturedAt,
        createdAt: payment.createdAt,
        invoice,
        proforma: {
          id: bill.id,
          number: bill.number,
          planName: bill.planName,
          listPriceMinor: bill.listPriceMinor,
          subtotalMinor: bill.subtotalMinor,
          discountMinor: bill.discountMinor,
          taxMinor: bill.taxMinor,
          totalMinor: bill.totalMinor,
          couponCode: bill.couponCode,
          createdBy: bill.createdBy
        },
        lead: {
          id: lead.id,
          code: leadCode(lead.number),
          schoolName: lead.schoolName,
          ownerName: lead.ownerName,
          email: lead.email,
          phone: lead.phone,
          gstin: lead.gstin,
          schoolId: lead.schoolId,
          onboardingStatus: lead.onboardingStatus,
          assignedTo: lead.assignedTo
        }
      };
    })
  };
}
