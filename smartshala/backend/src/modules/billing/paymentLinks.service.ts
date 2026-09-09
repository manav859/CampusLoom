import crypto from "node:crypto";
import { InvoiceStatus, PaymentLinkStatus } from "../../../node_modules/@smartshala/master-client/index.js";
import type { Prisma } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { razorpay } from "../../services/razorpay/index.js";
import { addDays } from "./billing.pricing.js";
import {
  confirmCheckout,
  ensureGatewayOrder,
  mockGatewayPay,
  recordBillingEvent,
  type BillingActor
} from "./billing.service.js";
import type { CheckoutSignature } from "../../services/razorpay/index.js";

/** 32 bytes of entropy — the token is the link's only credential. */
const TOKEN_BYTES = 32;

function assertMaster() {
  if (!isMasterDbConfigured()) {
    throw new AppError(503, "Billing is unavailable because the master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }
}

function publicUrl(token: string) {
  return `${env.FRONTEND_URL.replace(/\/$/, "")}/pay/${token}`;
}

const linkShape = {
  invoice: { select: { id: true, number: true, status: true, totalMinor: true, amountPaidMinor: true, planName: true } },
  school: { select: { schoolId: true, schoolName: true, email: true } }
} as const;

type LinkWithRelations = Prisma.PaymentLinkGetPayload<{ include: typeof linkShape }>;

function toAdminLink(link: LinkWithRelations) {
  return {
    id: link.id,
    token: link.token,
    url: publicUrl(link.token),
    status: link.status,
    amountMinor: link.amountMinor,
    currency: link.currency,
    note: link.note,
    createdBy: link.createdBy,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    firstViewedAt: link.firstViewedAt,
    paidAt: link.paidAt,
    revokedAt: link.revokedAt,
    invoice: link.invoice,
    school: link.school
  };
}

// --- Super admin -------------------------------------------------------------

/**
 * Mint a shareable link for one invoice. Any live link on that invoice is
 * revoked first, so exactly one URL is ever payable — a school that was sent
 * two reminders cannot pay twice by opening the older one.
 */
export async function createPaymentLink(input: {
  invoiceId: string;
  note?: string | null;
  expiresInDays?: number;
  actor: BillingActor;
}) {
  assertMaster();
  const invoice = await masterPrisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { school: { select: { schoolId: true, schoolName: true, email: true } } }
  });
  if (!invoice) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");
  if (invoice.status === InvoiceStatus.VOID) throw new AppError(409, "This invoice was voided", "INVOICE_VOID");

  const amountMinor = invoice.totalMinor - invoice.amountPaidMinor;
  if (amountMinor <= 0) throw new AppError(409, "This invoice is already settled", "INVOICE_ALREADY_PAID");

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = addDays(new Date(), input.expiresInDays ?? env.BILLING_PAYMENT_LINK_DAYS);

  const link = await masterPrisma.$transaction(async (tx) => {
    await tx.paymentLink.updateMany({
      where: { invoiceId: invoice.id, status: PaymentLinkStatus.ACTIVE },
      data: { status: PaymentLinkStatus.REVOKED, revokedAt: new Date() }
    });
    return tx.paymentLink.create({
      data: {
        token,
        invoiceId: invoice.id,
        schoolId: invoice.schoolId,
        amountMinor,
        currency: invoice.currency,
        note: input.note ?? null,
        createdBy: `${input.actor.kind}:${input.actor.label}`,
        expiresAt
      },
      include: linkShape
    });
  });

  await recordBillingEvent({
    schoolId: invoice.schoolId,
    actor: input.actor,
    action: "payment_link.created",
    message: `Payment link issued for ${invoice.number}, valid until ${expiresAt.toISOString().slice(0, 10)}`,
    metadata: { invoiceId: invoice.id, linkId: link.id }
  });

  return toAdminLink(link);
}

export async function listPaymentLinks(filters: { schoolId?: string; invoiceId?: string; take?: number } = {}) {
  assertMaster();
  const links = await masterPrisma.paymentLink.findMany({
    where: {
      ...(filters.schoolId ? { schoolId: filters.schoolId } : {}),
      ...(filters.invoiceId ? { invoiceId: filters.invoiceId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 100,
    include: linkShape
  });
  return links.map(toAdminLink);
}

export async function revokePaymentLink(linkId: string, actor: BillingActor) {
  assertMaster();
  const link = await masterPrisma.paymentLink.findUnique({ where: { id: linkId }, include: linkShape });
  if (!link) throw new AppError(404, "Payment link not found", "PAYMENT_LINK_NOT_FOUND");
  if (link.status !== PaymentLinkStatus.ACTIVE) return toAdminLink(link);

  const updated = await masterPrisma.paymentLink.update({
    where: { id: linkId },
    data: { status: PaymentLinkStatus.REVOKED, revokedAt: new Date() },
    include: linkShape
  });

  await recordBillingEvent({
    schoolId: link.schoolId,
    actor,
    action: "payment_link.revoked",
    message: `Payment link for ${link.invoice.number} was revoked`,
    metadata: { invoiceId: link.invoiceId, linkId }
  });

  return toAdminLink(updated);
}

// --- Public (token-authenticated) --------------------------------------------

/**
 * Everything a link needs before it will let anyone pay. A settled invoice is
 * not an error — the page has to be able to say "already paid" rather than
 * looking broken to a school that paid yesterday.
 */
async function loadLink(token: string) {
  assertMaster();
  const link = await masterPrisma.paymentLink.findUnique({
    where: { token },
    include: {
      invoice: { include: { school: true } }
    }
  });
  if (!link) throw new AppError(404, "This payment link is not valid", "PAYMENT_LINK_NOT_FOUND");
  if (link.status === PaymentLinkStatus.REVOKED) {
    throw new AppError(410, "This payment link has been cancelled", "PAYMENT_LINK_REVOKED");
  }
  return link;
}

function linkState(link: Awaited<ReturnType<typeof loadLink>>) {
  if (link.invoice.status === InvoiceStatus.VOID) return "VOID" as const;
  if (link.invoice.amountPaidMinor >= link.invoice.totalMinor) return "PAID" as const;
  if (link.expiresAt.getTime() < Date.now()) return "EXPIRED" as const;
  return "PAYABLE" as const;
}

/** The invoice as the link's recipient sees it. Deliberately narrow: no school
 *  contact details, no payment history, nothing but what is needed to pay. */
export async function getPaymentLinkView(token: string) {
  const link = await loadLink(token);

  if (!link.firstViewedAt) {
    await masterPrisma.paymentLink.update({ where: { id: link.id }, data: { firstViewedAt: new Date() } });
  }

  const { invoice } = link;
  return {
    state: linkState(link),
    expiresAt: link.expiresAt,
    note: link.note,
    seller: { name: env.BILLING_SELLER_NAME, supportEmail: env.BILLING_SUPPORT_EMAIL ?? null },
    school: { schoolId: invoice.school.schoolId, schoolName: invoice.school.schoolName },
    invoice: {
      number: invoice.number,
      planName: invoice.planName,
      currency: invoice.currency,
      subtotalMinor: invoice.subtotalMinor,
      discountMinor: invoice.discountMinor,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      amountPaidMinor: invoice.amountPaidMinor,
      amountDueMinor: Math.max(0, invoice.totalMinor - invoice.amountPaidMinor),
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt
    }
  };
}

function assertPayable(link: Awaited<ReturnType<typeof loadLink>>) {
  const state = linkState(link);
  if (state === "PAID") throw new AppError(409, "This invoice is already settled", "INVOICE_ALREADY_PAID");
  if (state === "VOID") throw new AppError(409, "This invoice was voided", "INVOICE_VOID");
  if (state === "EXPIRED") throw new AppError(410, "This payment link has expired", "PAYMENT_LINK_EXPIRED");
}

export async function startPaymentLinkCheckout(token: string) {
  const link = await loadLink(token);
  assertPayable(link);

  const { invoice } = link;
  const { order, amountDue } = await ensureGatewayOrder(invoice);

  await recordBillingEvent({
    schoolId: invoice.schoolId,
    actor: { kind: "SYSTEM", label: "payment-link" },
    action: "payment_link.checkout",
    message: `Payment link checkout opened for ${invoice.number}`,
    metadata: { invoiceId: invoice.id, linkId: link.id, orderId: order.id }
  });

  return {
    mode: razorpay.mode,
    keyId: razorpay.keyId,
    orderId: order.id,
    amountMinor: amountDue,
    currency: invoice.currency,
    invoice: { number: invoice.number, planName: invoice.planName },
    school: { schoolId: invoice.school.schoolId, schoolName: invoice.school.schoolName, email: invoice.school.email, phone: invoice.school.phone },
    seller: { name: env.BILLING_SELLER_NAME }
  };
}

export async function confirmPaymentLinkPayment(token: string, payload: CheckoutSignature) {
  const link = await loadLink(token);
  const actor: BillingActor = { kind: "SYSTEM", label: "payment-link" };

  // confirmCheckout owns signature verification and settlement; the link only
  // decides which school the callback is allowed to settle for.
  const result = await confirmCheckout({ schoolId: link.schoolId, payload, actor });

  await masterPrisma.paymentLink.update({
    where: { id: link.id },
    data: { status: PaymentLinkStatus.PAID, paidAt: new Date() }
  });

  return { status: result.status, invoiceNumber: result.invoice.number, alreadyCaptured: result.alreadyCaptured };
}

/** Mock-gateway only, exactly as the signed-in checkout does it. */
export async function payPaymentLinkViaMockGateway(input: {
  token: string;
  orderId: string;
  outcome: "success" | "failure";
  method: string;
}) {
  const link = await loadLink(input.token);
  assertPayable(link);

  const payment = await masterPrisma.payment.findUnique({ where: { providerOrderId: input.orderId } });
  if (!payment || payment.schoolId !== link.schoolId || payment.invoiceId !== link.invoiceId) {
    throw new AppError(404, "Order not found", "PAYMENT_ORDER_NOT_FOUND");
  }

  return mockGatewayPay({ orderId: input.orderId, outcome: input.outcome, method: input.method });
}
