import {
  InvoiceStatus,
  LeadStage,
  OnboardingStatus,
  PaymentLinkStatus,
  PaymentState,
  PaymentStatus,
  PlanType,
  ProformaStatus,
  SubscriptionStatus
} from "../../../node_modules/@smartshala/master-client/index.js";
import type { Proforma } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../core/errors.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";
import { createSchoolDatabase } from "../../services/createSchoolDatabase.js";
import { decimalAmount } from "../../services/coupon.service.js";
import { razorpay, type CheckoutSignature } from "../../services/razorpay/index.js";
import { generateUniqueSchoolId } from "../../utils/generateSchoolId.js";
import { periodEndFrom, rupeesFromMinor } from "../billing/billing.pricing.js";
import {
  findSubscription,
  getPlanByCodeOrThrow,
  nextInvoiceNumber,
  recordBillingEvent,
  syncSchoolFromSubscription,
  type BillingActor
} from "../billing/billing.service.js";
import { listSchoolUsers, resetTenantUserPassword } from "../superAdmin/superAdmin.service.js";
import { addActivity, leadCode, rupees, SYSTEM_NAME, temporaryPassword, type CrmActor } from "./crm.shared.js";

/**
 * A lead becomes a school here: its payment is settled against the proforma,
 * a school ID is reserved, and the school (database, principal login,
 * subscription, tax invoice) is set up. Every step can be repeated safely,
 * because the webhook, the browser callback and the reconciliation sweep can
 * all deliver the same payment, and a failed onboarding is retried by hand.
 */

/** A RUNNING onboarding older than this died with its process and may be picked up again. */
const STALE_ONBOARDING_MS = 15 * 60 * 1000;

async function reserveSchoolId() {
  return generateUniqueSchoolId(async (candidate) => {
    const [school, lead] = await Promise.all([
      masterPrisma.school.findUnique({ where: { schoolId: candidate }, select: { id: true } }),
      masterPrisma.lead.findUnique({ where: { schoolId: candidate }, select: { id: true } })
    ]);
    return Boolean(school || lead);
  });
}

export async function settleProformaPayment(input: {
  paymentId: string;
  providerPaymentId: string;
  signature: string | null;
  method: string | null;
  actor: BillingActor;
}) {
  const payment = await masterPrisma.payment.findUniqueOrThrow({
    where: { id: input.paymentId },
    include: { proforma: { include: { lead: true } } }
  });
  const { proforma } = payment;
  if (!proforma) throw new AppError(409, "This payment's proforma no longer exists", "PROFORMA_NOT_FOUND");
  const { lead } = proforma;

  const schoolId = lead.schoolId ?? (await reserveSchoolId());
  const now = new Date();

  const outcome = await masterPrisma.$transaction(async (tx) => {
    // Only the first delivery of this payment gets past here; the others wait
    // on the row lock, then find it already captured.
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: PaymentState.CAPTURED } },
      data: {
        status: PaymentState.CAPTURED,
        providerPaymentId: input.providerPaymentId,
        providerSignature: input.signature,
        method: input.method,
        capturedAt: now,
        failureReason: null
      }
    });
    if (claimed.count === 0) return null;

    const current = await tx.proforma.findUniqueOrThrow({ where: { id: proforma.id } });
    const amountPaidMinor = current.amountPaidMinor + payment.amountMinor;
    const settled = amountPaidMinor >= current.totalMinor;

    await tx.proforma.update({
      where: { id: current.id },
      data: { amountPaidMinor, ...(settled ? { status: ProformaStatus.PAID, paidAt: now } : {}) }
    });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "PAYMENT_RECEIVED",
        message: `${rupees(payment.amountMinor)} received against ${current.number}${input.method ? ` (${input.method})` : ""}`,
        actor: SYSTEM_NAME
      }
    });
    if (!settled) return { settled };

    await tx.paymentLink.updateMany({
      where: { proformaId: current.id, status: PaymentLinkStatus.ACTIVE },
      data: { status: PaymentLinkStatus.PAID, paidAt: now }
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: { stage: LeadStage.PAID, paidAt: now, schoolId, lostAt: null, lostReason: null }
    });
    if (current.couponCode) {
      await tx.coupon.updateMany({ where: { code: current.couponCode }, data: { redeemedCount: { increment: 1 } } });
    }
    return { settled };
  });

  const fresh = await masterPrisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { invoice: true } });
  if (!outcome) return { payment: fresh, invoice: fresh.invoice, alreadyCaptured: true as const };

  await recordBillingEvent({
    actor: input.actor,
    action: "payment.captured",
    message: `Payment captured for ${proforma.number} (${leadCode(lead.number)}) — INR ${rupeesFromMinor(payment.amountMinor)}`,
    metadata: { proformaId: proforma.id, paymentId: input.providerPaymentId }
  });

  // Setting up a school takes a while (a database and its migrations). Neither
  // the gateway nor the payer's browser should wait on it, so it runs on its
  // own; a failure is recorded on the lead and retried from the CRM.
  if (outcome.settled) {
    await startOnboarding(lead.id).catch((err) => logger.error({ err, leadId: lead.id }, "Lead onboarding could not start"));
  }

  return { payment: fresh, invoice: fresh.invoice, alreadyCaptured: false as const };
}

/** The payer's browser coming back from the gateway with a signed result. */
export async function confirmProformaPayment(input: { proformaId: string; payload: CheckoutSignature }) {
  const payment = await masterPrisma.payment.findUnique({
    where: { providerOrderId: input.payload.razorpay_order_id }
  });
  if (!payment) throw new AppError(404, "Payment order not found", "PAYMENT_ORDER_NOT_FOUND");
  if (payment.proformaId !== input.proformaId) {
    throw new AppError(403, "This order belongs to another payment", "PAYMENT_PROFORMA_MISMATCH");
  }

  if (!razorpay.verifyCheckoutSignature(input.payload)) {
    // Never let a forged callback undo a payment the webhook already captured.
    await masterPrisma.payment.updateMany({
      where: { id: payment.id, status: { not: PaymentState.CAPTURED } },
      data: { status: PaymentState.FAILED, failureReason: "Signature verification failed" }
    });
    throw new AppError(400, "Payment signature could not be verified", "INVALID_PAYMENT_SIGNATURE");
  }

  return settleProformaPayment({
    paymentId: payment.id,
    providerPaymentId: input.payload.razorpay_payment_id,
    signature: input.payload.razorpay_signature,
    method: "checkout",
    actor: { kind: "SYSTEM", label: "payment-link" }
  });
}

export async function recordProformaPaymentFailure(proformaId: string, reason: string) {
  const proforma = await masterPrisma.proforma.findUnique({ where: { id: proformaId } });
  if (proforma) await addActivity(proforma.leadId, "PAYMENT_FAILED", `Payment attempt on ${proforma.number} failed: ${reason}`, SYSTEM_NAME);
}

/**
 * The tax invoice for what the lead paid, the subscription it bought, and the
 * payment moved onto both. The amounts are the proforma's, to the paisa: the
 * school is billed what it was quoted, whatever the plan costs today.
 */
async function raiseTaxInvoice(schoolId: string, proforma: Proforma) {
  const plan =
    (proforma.planId ? await masterPrisma.plan.findUnique({ where: { id: proforma.planId } }) : null) ??
    (await getPlanByCodeOrThrow(proforma.planCode));
  const start = proforma.paidAt ?? new Date();
  const end = periodEndFrom(plan, start);
  const negotiated = proforma.subtotalMinor !== plan.priceMinor;
  const number = await nextInvoiceNumber();
  const now = new Date();

  const invoice = await masterPrisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        schoolId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        couponCode: proforma.couponCode,
        // A rate agreed on the proforma carries on into renewals.
        customPriceMinor: negotiated ? proforma.subtotalMinor : null,
        customPriceNote: negotiated ? `Agreed on proforma ${proforma.number}` : null
      }
    });
    const created = await tx.invoice.create({
      data: {
        number,
        schoolId,
        subscriptionId: subscription.id,
        planId: plan.id,
        planCode: proforma.planCode,
        planName: proforma.planName,
        status: InvoiceStatus.PAID,
        currency: proforma.currency,
        subtotalMinor: proforma.subtotalMinor,
        discountMinor: proforma.discountMinor,
        taxMinor: proforma.taxMinor,
        totalMinor: proforma.totalMinor,
        amountPaidMinor: proforma.amountPaidMinor,
        couponCode: proforma.couponCode,
        periodStart: start,
        periodEnd: end,
        issuedAt: now,
        dueAt: now,
        paidAt: start,
        notes: `Against proforma ${proforma.number}`
      }
    });
    await tx.proforma.update({ where: { id: proforma.id }, data: { invoiceId: created.id } });
    await tx.payment.updateMany({ where: { proformaId: proforma.id }, data: { schoolId, invoiceId: created.id } });
    return created;
  });

  const subscription = await findSubscription(schoolId);
  if (subscription) await syncSchoolFromSubscription(subscription);
  return invoice;
}

/**
 * Turn a paid lead into a live school. Claiming is quick and happens before
 * this returns; the setup itself runs on in the background, and `done` settles
 * when it finishes. Returns null when there is nothing to start — not paid
 * yet, already onboarded, or another run is busy with it.
 */
export async function startOnboarding(leadId: string) {
  const claimed = await masterPrisma.lead.updateMany({
    where: {
      id: leadId,
      stage: LeadStage.PAID,
      schoolId: { not: null },
      OR: [
        { onboardingStatus: { in: [OnboardingStatus.NOT_STARTED, OnboardingStatus.FAILED] } },
        { onboardingStatus: OnboardingStatus.RUNNING, updatedAt: { lt: new Date(Date.now() - STALE_ONBOARDING_MS) } }
      ]
    },
    data: { onboardingStatus: OnboardingStatus.RUNNING, onboardingError: null }
  });
  if (claimed.count === 0) return null;
  const done = runOnboarding(leadId).catch((err) => {
    logger.error({ err, leadId }, "Lead onboarding crashed");
    return false;
  });
  return { done };
}

async function runOnboarding(leadId: string) {
  const lead = await masterPrisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { proformas: { where: { status: ProformaStatus.PAID }, orderBy: { paidAt: "desc" }, take: 1 } }
  });
  const schoolId = lead.schoolId!;
  const proforma = lead.proformas[0];

  try {
    if (!proforma) throw new Error("This deal has no paid proforma");
    await addActivity(lead.id, "ONBOARDING", `Setting up school ${schoolId}`, SYSTEM_NAME);

    if (!(await masterPrisma.school.findUnique({ where: { schoolId }, select: { id: true } }))) {
      await masterPrisma.onboardingLog
        .create({ data: { schoolId, status: "STARTED", message: `Onboarding started for ${lead.schoolName} (${leadCode(lead.number)})` } })
        .catch(() => undefined);

      // This password is thrown away. The principal's real one is set when a
      // salesperson issues login details from the lead.
      const db = await createSchoolDatabase({
        schoolId,
        schoolName: lead.schoolName,
        ownerName: lead.ownerName,
        email: lead.email,
        phone: lead.phone,
        address: lead.address ?? undefined,
        dbName: `school_${schoolId}`,
        adminPassword: temporaryPassword(16)
      });

      await masterPrisma.school.create({
        data: {
          schoolId,
          schoolName: lead.schoolName,
          ownerName: lead.ownerName,
          email: lead.email,
          phone: lead.phone,
          address: lead.address ?? "",
          gstin: lead.gstin,
          stateName: lead.stateName,
          stateCode: lead.stateCode,
          numberOfStudents: lead.numberOfStudents ?? 0,
          numberOfStaff: lead.numberOfStaff ?? 0,
          planType: PlanType.STANDARD,
          paymentStatus: PaymentStatus.PAID,
          amountPaid: decimalAmount(rupeesFromMinor(proforma.amountPaidMinor)),
          couponCode: proforma.couponCode,
          isTrial: false,
          isActive: true,
          dbName: db.dbName,
          dbUrl: db.dbUrl,
          directDbUrl: db.directDbUrl
        }
      });
    }

    const invoice = proforma.invoiceId
      ? await masterPrisma.invoice.findUniqueOrThrow({ where: { id: proforma.invoiceId } })
      : await raiseTaxInvoice(schoolId, proforma);

    await masterPrisma.lead.update({
      where: { id: lead.id },
      data: {
        stage: LeadStage.ONBOARDED,
        onboardingStatus: OnboardingStatus.DONE,
        onboardingError: null,
        onboardedAt: new Date()
      }
    });
    await addActivity(
      lead.id,
      "ONBOARDED",
      `School ${schoolId} is live and tax invoice ${invoice.number} is issued. Share the login details with the principal.`,
      SYSTEM_NAME
    );
    await recordBillingEvent({
      schoolId,
      actor: { kind: "SYSTEM", label: "crm" },
      action: "subscription.created",
      message: `Onboarded from deal ${leadCode(lead.number)} on ${proforma.planName}`
    });
    await masterPrisma.onboardingLog
      .create({ data: { schoolId, status: "ACTIVE", message: `Onboarded from deal ${leadCode(lead.number)}` } })
      .catch(() => undefined);
    logger.info({ schoolId, leadId }, "Lead onboarded");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown onboarding failure";
    logger.error({ err: error, schoolId, leadId }, "Lead onboarding failed");
    await masterPrisma.lead.update({
      where: { id: lead.id },
      data: { onboardingStatus: OnboardingStatus.FAILED, onboardingError: message.slice(0, 1000) }
    });
    await addActivity(lead.id, "ONBOARDING_FAILED", `Setting up school ${schoolId} failed: ${message}`, SYSTEM_NAME);
    await masterPrisma.onboardingLog.create({ data: { schoolId, status: "FAILED", message } }).catch(() => undefined);
    return false;
  }
}

/**
 * Set a fresh temporary password on the principal and hand back the message
 * to send them. Nothing here is stored in plain text, so every call replaces
 * the previous password — the last message sent is the one that works.
 */
export async function issueLoginDetails(leadId: string, actor: CrmActor) {
  const lead = await masterPrisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError(404, "Deal not found", "LEAD_NOT_FOUND");
  if (!lead.schoolId || lead.onboardingStatus !== OnboardingStatus.DONE) {
    throw new AppError(409, "This school is not set up yet", "LEAD_NOT_ONBOARDED");
  }

  const { users } = await listSchoolUsers(lead.schoolId);
  const principals = users.filter((user) => user.role === "PRINCIPAL");
  const principal = principals.find((user) => user.email?.toLowerCase() === lead.email.toLowerCase()) ?? principals[0];
  if (!principal) throw new AppError(409, "This school has no principal account", "PRINCIPAL_NOT_FOUND");

  const password = temporaryPassword();
  await resetTenantUserPassword(lead.schoolId, principal.id, password);

  const identifier = principal.email ?? principal.phone;
  const loginUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/${lead.schoolId}/login`;
  await addActivity(lead.id, "LOGIN_ISSUED", `Login details issued for ${identifier}; any earlier password no longer works`, actor.name);

  return {
    phone: lead.phone,
    loginUrl,
    identifier,
    password,
    message: [
      `Welcome to SmartShala, ${lead.ownerName}!`,
      `${lead.schoolName} is ready.`,
      "",
      `School ID: ${lead.schoolId}`,
      `Login: ${loginUrl}`,
      `Email: ${identifier}`,
      `Temporary password: ${password}`,
      "",
      "Please change your password after you sign in."
    ].join("\n")
  };
}
