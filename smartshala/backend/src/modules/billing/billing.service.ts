import crypto from "node:crypto";
import {
  GatewayMode,
  InvoiceStatus,
  PaymentState,
  PaymentStatus,
  PlanType,
  Prisma,
  SubscriptionStatus,
  TenantDeletionStatus
} from "../../../node_modules/@smartshala/master-client/index.js";
import type { Plan, Subscription } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../core/errors.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { razorpay, signCheckout, markMockOrderPaid, isMockGateway } from "../../services/razorpay/index.js";
import type { CheckoutSignature } from "../../services/razorpay/index.js";
import { addDays, effectivePriceMinor, periodEndFrom, quotePlan, rupeesFromMinor } from "./billing.pricing.js";
import { generateInvoicePdf } from "./invoice-pdf.js";
import {
  notifyGraceEnding,
  notifyInvoiceRaised,
  notifyPastDue,
  notifyPaymentFailed,
  notifyPaymentReceived,
  notifySuspended
} from "./billing.notifications.js";

export type BillingActor = { kind: "PRINCIPAL" | "SUPER_ADMIN" | "SYSTEM" | "WEBHOOK"; label: string };

export const SYSTEM_ACTOR: BillingActor = { kind: "SYSTEM", label: "system" };

/** How long an unpaid gateway order stays reusable before it is abandoned. */
const CHECKOUT_ORDER_TTL_MS = 30 * 60 * 1000;

/** How close the grace window has to be to closing before the last warning. */
const GRACE_WARNING_DAYS = 2;

function assertMaster() {
  if (!isMasterDbConfigured()) {
    throw new AppError(503, "Billing is unavailable because the master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }
}

export async function recordBillingEvent(input: {
  schoolId?: string | null;
  actor: BillingActor;
  action: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await masterPrisma.billingEvent
    .create({
      data: {
        schoolId: input.schoolId ?? null,
        actor: `${input.actor.kind}:${input.actor.label}`,
        action: input.action,
        message: input.message,
        metadata: input.metadata
      }
    })
    .catch((err) => logger.error({ err, action: input.action }, "Failed to record billing event"));
}

// --- Plans -------------------------------------------------------------------

export async function listPlans({ publicOnly }: { publicOnly: boolean }) {
  assertMaster();
  return masterPrisma.plan.findMany({
    where: publicOnly ? { isActive: true, isPublic: true } : {},
    orderBy: [{ sortOrder: "asc" }, { priceMinor: "asc" }]
  });
}

export async function getPlanByCodeOrThrow(code: string) {
  assertMaster();
  const plan = await masterPrisma.plan.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!plan) throw new AppError(404, "Plan not found", "PLAN_NOT_FOUND");
  return plan;
}

async function trialPlan() {
  return (
    (await masterPrisma.plan.findFirst({ where: { trialDays: { gt: 0 } }, orderBy: { sortOrder: "asc" } })) ??
    (await masterPrisma.plan.findFirst({ orderBy: { sortOrder: "asc" } }))
  );
}

// --- Subscription ------------------------------------------------------------

export type SubscriptionWithPlan = Subscription & { plan: Plan };

export async function findSubscription(schoolId: string): Promise<SubscriptionWithPlan | null> {
  assertMaster();
  return masterPrisma.subscription.findUnique({ where: { schoolId }, include: { plan: true } });
}

/**
 * Every school must have a subscription row — schools onboarded before billing
 * existed, or created while the plan table was empty, are lazily backfilled
 * onto the trial plan rather than 500-ing the subscription page.
 */
export async function ensureSubscription(schoolId: string): Promise<SubscriptionWithPlan> {
  const existing = await findSubscription(schoolId);
  if (existing) return existing;

  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) {
    // Legacy single-tenant workspaces predate the master registry, so they have
    // no school row to hang a subscription off. Say so plainly instead of
    // showing the principal a bare "School not found".
    throw new AppError(
      404,
      "This workspace is not registered for online billing yet. Please contact SmartShala support.",
      "SCHOOL_NOT_REGISTERED"
    );
  }

  const plan = await trialPlan();
  if (!plan) throw new AppError(503, "No subscription plans are configured yet", "NO_PLANS_CONFIGURED");

  const start = school.createdAt;
  const end = school.trialEndsAt ?? addDays(start, plan.trialDays || 30);

  return masterPrisma.subscription.create({
    data: {
      schoolId,
      planId: plan.id,
      status: end > new Date() ? SubscriptionStatus.TRIALING : SubscriptionStatus.PAST_DUE,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      couponCode: school.couponCode
    },
    include: { plan: true }
  });
}

/**
 * Mirror the subscription onto the legacy School columns. The tenant resolver,
 * the super admin list and the old onboarding screens all still read those, so
 * they must never drift from the subscription that now owns the truth.
 */
export async function syncSchoolFromSubscription(subscription: SubscriptionWithPlan) {
  const isTrial = subscription.plan.priceMinor === 0 || subscription.status === SubscriptionStatus.TRIALING;
  const hasAccess =
    subscription.status === SubscriptionStatus.ACTIVE ||
    subscription.status === SubscriptionStatus.TRIALING ||
    (subscription.status === SubscriptionStatus.PAST_DUE &&
      subscription.gracePeriodEndsAt !== null &&
      subscription.gracePeriodEndsAt > new Date());

  await masterPrisma.school.update({
    where: { schoolId: subscription.schoolId },
    data: {
      isActive: hasAccess,
      isTrial,
      planType: isTrial ? PlanType.TRIAL : PlanType.STANDARD,
      trialEndsAt: isTrial ? subscription.currentPeriodEnd : null,
      paymentStatus:
        subscription.status === SubscriptionStatus.ACTIVE && !isTrial
          ? PaymentStatus.PAID
          : isTrial
            ? PaymentStatus.TRIAL
            : PaymentStatus.PENDING
    }
  });
}

// --- Invoices ----------------------------------------------------------------

async function nextInvoiceNumber() {
  const [row] = await masterPrisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq')`;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(row.nextval).padStart(6, "0")}`;
}

export async function createInvoice(input: {
  schoolId: string;
  plan: Plan;
  subscriptionId: string | null;
  periodStart: Date;
  periodEnd: Date;
  couponCode?: string | null;
  notes?: string | null;
  status?: InvoiceStatus;
  /** Carries the school negotiated rate, if it has one. */
  subscription?: { customPriceMinor: number | null } | null;
}) {
  const quote = await quotePlan(input.plan, input.couponCode, input.subscription);
  if (input.couponCode && !quote.couponValid) {
    throw new AppError(400, quote.couponMessage, "INVALID_COUPON");
  }

  return masterPrisma.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      schoolId: input.schoolId,
      subscriptionId: input.subscriptionId,
      planId: input.plan.id,
      planCode: input.plan.code,
      planName: input.plan.name,
      status: input.status ?? InvoiceStatus.DUE,
      currency: quote.currency,
      subtotalMinor: quote.subtotalMinor,
      discountMinor: quote.discountMinor,
      taxMinor: quote.taxMinor,
      totalMinor: quote.totalMinor,
      couponCode: quote.couponCode,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      dueAt: addDays(new Date(), env.BILLING_INVOICE_DUE_DAYS),
      notes: input.notes ?? null
    }
  });
}

export async function listInvoices(schoolId: string, take = 50) {
  assertMaster();
  return masterPrisma.invoice.findMany({
    where: { schoolId },
    orderBy: { issuedAt: "desc" },
    take,
    include: { payments: { orderBy: { createdAt: "desc" } } }
  });
}

export async function getInvoice(schoolId: string, invoiceId: string) {
  assertMaster();
  const invoice = await masterPrisma.invoice.findFirst({
    where: { id: invoiceId, schoolId },
    include: { payments: { orderBy: { createdAt: "desc" } } }
  });
  if (!invoice) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");
  return invoice;
}

/**
 * The invoice as a document the school can file, print or forward to their
 * accountant. `schoolId` scopes it to one school for the principal; the super
 * admin passes nothing and can render any invoice.
 */
export async function renderInvoicePdf(invoiceId: string, schoolId?: string) {
  assertMaster();
  const invoice = await masterPrisma.invoice.findFirst({
    where: schoolId ? { id: invoiceId, schoolId } : { id: invoiceId },
    include: { payments: { orderBy: { createdAt: "asc" } }, school: true }
  });
  if (!invoice) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");

  const buffer = await generateInvoicePdf({
    seller: {
      name: env.BILLING_SELLER_NAME,
      address: env.BILLING_SELLER_ADDRESS ?? null,
      email: env.BILLING_SUPPORT_EMAIL ?? null,
      phone: env.BILLING_SELLER_PHONE ?? null,
      gstin: env.BILLING_SELLER_GSTIN ?? null,
      pan: env.BILLING_SELLER_PAN ?? null,
      stateName: env.BILLING_SELLER_STATE ?? null,
      stateCode: env.BILLING_SELLER_STATE_CODE ?? null
    },
    school: {
      schoolId: invoice.school.schoolId,
      schoolName: invoice.school.schoolName,
      ownerName: invoice.school.ownerName,
      email: invoice.school.email,
      phone: invoice.school.phone,
      address: invoice.school.address,
      gstin: invoice.school.gstin,
      stateName: invoice.school.stateName,
      stateCode: invoice.school.stateCode
    },
    invoice: {
      number: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      planName: invoice.planName,
      planCode: invoice.planCode,
      sacCode: env.BILLING_SAC_CODE,
      subtotalMinor: invoice.subtotalMinor,
      discountMinor: invoice.discountMinor,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      amountPaidMinor: invoice.amountPaidMinor,
      couponCode: invoice.couponCode,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      notes: invoice.notes
    },
    payments: invoice.payments.map((payment) => ({
      status: payment.status,
      method: payment.method,
      reference: payment.providerPaymentId ?? payment.providerOrderId ?? null,
      amountMinor: payment.amountMinor,
      refundedMinor: payment.refundedMinor,
      at: payment.capturedAt ?? payment.createdAt
    }))
  });

  return { buffer, number: invoice.number };
}

// --- Checkout ----------------------------------------------------------------

/**
 * Where the next paid term should start: immediately for a lapsed or trialling
 * school, at the end of the current term for a renewal that is paid early.
 */
function nextPeriodStart(subscription: SubscriptionWithPlan | null, planCode: string) {
  const now = new Date();
  if (!subscription) return now;
  const renewingSamePlan = subscription.plan.code === planCode && subscription.status === SubscriptionStatus.ACTIVE;
  if (renewingSamePlan && subscription.currentPeriodEnd > now) return subscription.currentPeriodEnd;
  return now;
}

export async function createCheckoutSession(input: {
  schoolId: string;
  planCode: string;
  couponCode?: string | null;
  actor: BillingActor;
}) {
  assertMaster();
  const school = await masterPrisma.school.findUnique({ where: { schoolId: input.schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");
  if (school.deletionStatus === TenantDeletionStatus.DELETED) {
    throw new AppError(409, "This school has been deleted", "SCHOOL_DELETED");
  }

  const plan = await getPlanByCodeOrThrow(input.planCode);
  if (!plan.isActive) throw new AppError(409, "That plan is no longer available", "PLAN_INACTIVE");
  if (plan.priceMinor <= 0) {
    throw new AppError(400, "Free plans cannot be purchased. Ask support to switch you over.", "PLAN_NOT_PURCHASABLE");
  }

  const subscription = await ensureSubscription(input.schoolId);
  const periodStart = nextPeriodStart(subscription, plan.code);
  const periodEnd = periodEndFrom(plan, periodStart);

  // Reuse an open invoice for the same plan+coupon so a refreshed checkout page
  // does not leave a trail of duplicate dues.
  const quote = await quotePlan(plan, input.couponCode, subscription);
  if (input.couponCode && !quote.couponValid) throw new AppError(400, quote.couponMessage, "INVALID_COUPON");

  const existing = await masterPrisma.invoice.findFirst({
    where: {
      schoolId: input.schoolId,
      status: InvoiceStatus.DUE,
      planCode: plan.code,
      totalMinor: quote.totalMinor,
      couponCode: quote.couponCode
    },
    orderBy: { issuedAt: "desc" }
  });

  const invoice =
    existing ??
    (await createInvoice({
      schoolId: input.schoolId,
      plan,
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
      couponCode: input.couponCode,
      subscription
    }));

  const { order, payment, amountDue } = await ensureGatewayOrder(invoice);

  await recordBillingEvent({
    schoolId: input.schoolId,
    actor: input.actor,
    action: "checkout.created",
    message: `Checkout started for ${plan.name} (${invoice.number}) — INR ${rupeesFromMinor(amountDue)}`,
    metadata: { invoiceId: invoice.id, orderId: order.id }
  });

  return {
    mode: razorpay.mode,
    keyId: razorpay.keyId,
    orderId: order.id,
    paymentId: payment.id,
    amountMinor: amountDue,
    currency: invoice.currency,
    invoice: {
      id: invoice.id,
      number: invoice.number,
      planCode: invoice.planCode,
      planName: invoice.planName,
      subtotalMinor: invoice.subtotalMinor,
      discountMinor: invoice.discountMinor,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd
    },
    school: { schoolId: school.schoolId, schoolName: school.schoolName, email: school.email, phone: school.phone }
  };
}

/**
 * The gateway order an invoice should be paid against. Reopening the checkout
 * page, double-clicking Pay now, or following a payment link the school was
 * sent must not stack a second order on the same invoice: reuse the open one
 * while the gateway still recognises it, and only mint a fresh order once it
 * has gone.
 */
export async function ensureGatewayOrder(invoice: {
  id: string;
  schoolId: string;
  number: string;
  currency: string;
  planCode: string;
  totalMinor: number;
  amountPaidMinor: number;
}) {
  const amountDue = invoice.totalMinor - invoice.amountPaidMinor;
  if (amountDue <= 0) throw new AppError(409, "This invoice is already settled", "INVOICE_ALREADY_PAID");

  const openPayment = await masterPrisma.payment.findFirst({
    where: {
      invoiceId: invoice.id,
      status: PaymentState.CREATED,
      amountMinor: amountDue,
      createdAt: { gt: new Date(Date.now() - CHECKOUT_ORDER_TTL_MS) }
    },
    orderBy: { createdAt: "desc" }
  });

  const reusable =
    openPayment?.providerOrderId && (await razorpay.fetchOrder(openPayment.providerOrderId).catch(() => null));

  const order = reusable
    ? reusable
    : await razorpay.createOrder({
        amountMinor: amountDue,
        currency: invoice.currency,
        receipt: invoice.number,
        notes: { schoolId: invoice.schoolId, invoiceId: invoice.id, planCode: invoice.planCode }
      });

  const payment =
    reusable && openPayment
      ? openPayment
      : await masterPrisma.payment.create({
          data: {
            invoiceId: invoice.id,
            schoolId: invoice.schoolId,
            gatewayMode: isMockGateway() ? GatewayMode.MOCK : GatewayMode.LIVE,
            providerOrderId: order.id,
            status: PaymentState.CREATED,
            amountMinor: amountDue,
            currency: invoice.currency,
            notes: { planCode: invoice.planCode, invoiceNumber: invoice.number }
          }
        });

  return { order, payment, amountDue };
}

/**
 * Settle an invoice and move the subscription forward. Safe to call twice for
 * the same payment — the checkout callback and the webhook usually race.
 */
async function applySuccessfulPayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string | null;
  method: string | null;
  actor: BillingActor;
}) {
  const payment = await masterPrisma.payment.findUnique({
    where: { providerOrderId: input.providerOrderId },
    include: { invoice: true }
  });
  if (!payment) throw new AppError(404, "Payment order not found", "PAYMENT_ORDER_NOT_FOUND");

  if (payment.status === PaymentState.CAPTURED) {
    return { payment, invoice: payment.invoice, alreadyCaptured: true as const };
  }

  const invoice = payment.invoice;
  if (invoice.status === InvoiceStatus.VOID) {
    throw new AppError(409, "This invoice was voided", "INVOICE_VOID");
  }

  const plan = invoice.planId ? await masterPrisma.plan.findUnique({ where: { id: invoice.planId } }) : null;
  const now = new Date();

  await masterPrisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentState.CAPTURED,
        providerPaymentId: input.providerPaymentId,
        providerSignature: input.signature,
        method: input.method,
        capturedAt: now,
        failureReason: null
      }
    });

    const amountPaidMinor = invoice.amountPaidMinor + payment.amountMinor;
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaidMinor,
        status: amountPaidMinor >= invoice.totalMinor ? InvoiceStatus.PAID : invoice.status,
        paidAt: amountPaidMinor >= invoice.totalMinor ? now : invoice.paidAt
      }
    });

    if (plan) {
      await tx.subscription.update({
        where: { schoolId: invoice.schoolId },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: invoice.periodStart,
          currentPeriodEnd: invoice.periodEnd,
          gracePeriodEndsAt: null,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          couponCode: invoice.couponCode
        }
      });
    }

    await tx.school.update({
      where: { schoolId: invoice.schoolId },
      data: { amountPaid: new Prisma.Decimal(rupeesFromMinor(payment.amountMinor)) }
    });

    if (invoice.couponCode) {
      await tx.coupon.updateMany({
        where: { code: invoice.couponCode },
        data: { redeemedCount: { increment: 1 } }
      });
    }
  });

  const subscription = await findSubscription(invoice.schoolId);
  if (subscription) await syncSchoolFromSubscription(subscription);

  await recordBillingEvent({
    schoolId: invoice.schoolId,
    actor: input.actor,
    action: "payment.captured",
    message: `Payment captured for ${invoice.number} — INR ${rupeesFromMinor(payment.amountMinor)}`,
    metadata: { invoiceId: invoice.id, paymentId: input.providerPaymentId }
  });

  const fresh = await masterPrisma.payment.findUniqueOrThrow({
    where: { id: payment.id },
    include: { invoice: true }
  });
  // Only once the invoice is actually settled — a part payment has not bought
  // the term the receipt message promises.
  if (fresh.invoice.status === InvoiceStatus.PAID) {
    await notifyPaymentReceived(fresh.invoice, payment.amountMinor);
  }
  return { payment: fresh, invoice: fresh.invoice, alreadyCaptured: false as const };
}

export async function confirmCheckout(input: {
  schoolId: string;
  payload: CheckoutSignature;
  actor: BillingActor;
}) {
  assertMaster();
  const payment = await masterPrisma.payment.findUnique({
    where: { providerOrderId: input.payload.razorpay_order_id }
  });
  if (!payment) throw new AppError(404, "Payment order not found", "PAYMENT_ORDER_NOT_FOUND");
  if (payment.schoolId !== input.schoolId) {
    throw new AppError(403, "This order belongs to another school", "PAYMENT_SCHOOL_MISMATCH");
  }

  if (!razorpay.verifyCheckoutSignature(input.payload)) {
    await masterPrisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentState.FAILED, failureReason: "Signature verification failed" }
    });
    await recordBillingEvent({
      schoolId: input.schoolId,
      actor: input.actor,
      action: "payment.signature_invalid",
      message: `Rejected payment callback for order ${input.payload.razorpay_order_id}: bad signature`
    });
    throw new AppError(400, "Payment signature could not be verified", "INVALID_PAYMENT_SIGNATURE");
  }

  const result = await applySuccessfulPayment({
    providerOrderId: input.payload.razorpay_order_id,
    providerPaymentId: input.payload.razorpay_payment_id,
    signature: input.payload.razorpay_signature,
    method: "checkout",
    actor: input.actor
  });

  return {
    status: "PAID" as const,
    alreadyCaptured: result.alreadyCaptured,
    invoice: result.invoice,
    subscription: await findSubscription(input.schoolId)
  };
}

export async function markPaymentFailed(input: { providerOrderId: string; reason: string; actor: BillingActor }) {
  const payment = await masterPrisma.payment.findUnique({
    where: { providerOrderId: input.providerOrderId },
    include: { invoice: true }
  });
  if (!payment || payment.status === PaymentState.CAPTURED) return payment;

  const updated = await masterPrisma.payment.update({
    where: { id: payment.id },
    data: { status: PaymentState.FAILED, failureReason: input.reason }
  });

  await recordBillingEvent({
    schoolId: payment.schoolId,
    actor: input.actor,
    action: "payment.failed",
    message: `Payment failed for order ${input.providerOrderId}: ${input.reason}`
  });

  await notifyPaymentFailed({
    schoolId: payment.schoolId,
    invoiceNumber: payment.invoice.number,
    providerOrderId: input.providerOrderId,
    reason: input.reason
  });

  return updated;
}

// --- Mock gateway ------------------------------------------------------------

/**
 * Stands in for Razorpay's own servers: it is the only place allowed to mint a
 * payment id and sign it with the key secret, exactly as the real gateway does.
 */
export async function mockGatewayPay(input: { orderId: string; outcome: "success" | "failure"; method: string }) {
  const payment = await masterPrisma.payment.findUnique({ where: { providerOrderId: input.orderId } });
  if (!payment) throw new AppError(404, "Order not found", "PAYMENT_ORDER_NOT_FOUND");

  if (input.outcome === "failure") {
    await markPaymentFailed({
      providerOrderId: input.orderId,
      reason: "Payment declined at the (mock) gateway",
      actor: { kind: "SYSTEM", label: "mock-gateway" }
    });
    return { status: "failed" as const, reason: "Payment declined at the (mock) gateway" };
  }

  const razorpayPaymentId = `pay_${crypto.randomBytes(9).toString("hex").slice(0, 14)}`;
  markMockOrderPaid(input.orderId, razorpayPaymentId, input.method);

  // Razorpay notifies the server before the browser returns; emit the webhook
  // first so the callback path is genuinely the second writer, like in prod.
  await emitMockWebhook("payment.captured", {
    payment: {
      entity: {
        id: razorpayPaymentId,
        order_id: input.orderId,
        amount: payment.amountMinor,
        currency: payment.currency,
        method: input.method,
        status: "captured"
      }
    }
  });

  return {
    status: "success" as const,
    razorpay_order_id: input.orderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: signCheckout(input.orderId, razorpayPaymentId)
  };
}

async function emitMockWebhook(event: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({
    entity: "event",
    event,
    created_at: Math.floor(Date.now() / 1000),
    payload
  });
  const { signWebhook } = await import("../../services/razorpay/index.js");
  await handleRazorpayWebhook(body, signWebhook(body)).catch((err) =>
    logger.error({ err, event }, "Mock webhook delivery failed")
  );
}

// --- Webhook -----------------------------------------------------------------

type RazorpayWebhookBody = {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        method?: string;
        error_description?: string;
      };
    };
  };
};

export async function handleRazorpayWebhook(rawBody: string, signature: string | undefined) {
  assertMaster();

  const valid = Boolean(signature) && razorpay.verifyWebhookSignature(rawBody, signature!);
  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    throw new AppError(400, "Webhook body is not valid JSON", "WEBHOOK_BAD_BODY");
  }

  const entity = body.payload?.payment?.entity;
  const eventType = body.event ?? "unknown";
  // Razorpay only guarantees uniqueness per delivery via x-razorpay-event-id;
  // the payment id plus event name is the stable fallback both modes can build.
  const eventId = `${eventType}:${entity?.id ?? crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;

  const where = { provider_eventId: { provider: "razorpay", eventId } };

  if (!valid) {
    // Upsert, not create: a retried forgery reuses the same eventId and must
    // not blow up on the unique index.
    await masterPrisma.webhookEvent
      .upsert({
        where,
        create: { eventId, eventType, payload: body as Prisma.InputJsonValue, signatureValid: false, error: "Invalid signature" },
        update: { error: "Invalid signature" }
      })
      .catch(() => undefined);
    throw new AppError(400, "Invalid webhook signature", "INVALID_WEBHOOK_SIGNATURE");
  }

  const existing = await masterPrisma.webhookEvent.findUnique({ where });
  if (existing?.processedAt) return { status: "duplicate" as const, eventId };

  const record = await masterPrisma.webhookEvent.upsert({
    where,
    create: { eventId, eventType, payload: body as Prisma.InputJsonValue, signatureValid: true },
    update: { signatureValid: true, payload: body as Prisma.InputJsonValue, error: null }
  });

  try {
    if (eventType === "payment.captured" && entity?.order_id && entity.id) {
      await applySuccessfulPayment({
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
        signature: null,
        method: entity.method ?? "unknown",
        actor: { kind: "WEBHOOK", label: "razorpay" }
      });
    } else if (eventType === "payment.failed" && entity?.order_id) {
      await markPaymentFailed({
        providerOrderId: entity.order_id,
        reason: entity.error_description ?? "Payment failed at the gateway",
        actor: { kind: "WEBHOOK", label: "razorpay" }
      });
    }

    await masterPrisma.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date() } });
    return { status: "processed" as const, eventId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook failure";
    await masterPrisma.webhookEvent.update({ where: { id: record.id }, data: { error: message } });
    logger.error({ err: error, eventId }, "Razorpay webhook processing failed");
    throw error;
  }
}

// --- Subscription controls ---------------------------------------------------

export async function setCancelAtPeriodEnd(schoolId: string, cancel: boolean, actor: BillingActor) {
  const subscription = await ensureSubscription(schoolId);
  const updated = await masterPrisma.subscription.update({
    where: { schoolId },
    data: { cancelAtPeriodEnd: cancel, cancelledAt: cancel ? new Date() : null },
    include: { plan: true }
  });

  await recordBillingEvent({
    schoolId,
    actor,
    action: cancel ? "subscription.cancel_scheduled" : "subscription.cancel_reverted",
    message: cancel
      ? `Auto-renewal turned off; access ends ${subscription.currentPeriodEnd.toISOString()}`
      : "Auto-renewal turned back on"
  });

  return updated;
}

// --- Overview for the principal ---------------------------------------------

export async function getBillingOverview(schoolId: string, usage: { students: number; staff: number }) {
  assertMaster();
  const subscription = await ensureSubscription(schoolId);
  const school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId } });

  const [invoices, openInvoice] = await Promise.all([
    listInvoices(schoolId, 24),
    masterPrisma.invoice.findFirst({
      where: { schoolId, status: InvoiceStatus.DUE },
      orderBy: { issuedAt: "asc" }
    })
  ]);

  const now = new Date();
  const msLeft = subscription.currentPeriodEnd.getTime() - now.getTime();
  const paidTotalMinor = invoices
    .filter((invoice) => invoice.status === InvoiceStatus.PAID)
    .reduce((sum, invoice) => sum + invoice.amountPaidMinor, 0);

  return {
    school: { schoolId: school.schoolId, schoolName: school.schoolName, email: school.email, phone: school.phone },
    subscription: {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      daysRemaining: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
      isExpired: msLeft <= 0,
      couponCode: subscription.couponCode
    },
    plan: subscription.plan,
    pricing: {
      listPriceMinor: subscription.plan.priceMinor,
      effectivePriceMinor: effectivePriceMinor(subscription.plan, subscription),
      isCustomPrice: subscription.customPriceMinor !== null
    },
    usage: {
      students: usage.students,
      staff: usage.staff,
      maxStudents: subscription.plan.maxStudents,
      maxStaff: subscription.plan.maxStaff,
      studentsOverLimit: subscription.plan.maxStudents !== null && usage.students > subscription.plan.maxStudents,
      staffOverLimit: subscription.plan.maxStaff !== null && usage.staff > subscription.plan.maxStaff
    },
    openInvoice,
    invoices,
    totals: { paidMinor: paidTotalMinor, currency: subscription.plan.currency },
    gateway: { mode: razorpay.mode, keyId: razorpay.keyId }
  };
}

// --- Lifecycle worker --------------------------------------------------------

/**
 * Runs hourly. Issues renewal invoices ahead of time, drops lapsed schools into
 * a grace period, and finally suspends them when that grace period runs out.
 */
export async function runSubscriptionMaintenance() {
  if (!isMasterDbConfigured()) {
    return { renewalsIssued: 0, recoveredPayments: 0, abandonedPayments: 0, movedToPastDue: 0, expired: 0 };
  }
  const now = new Date();
  let renewalsIssued = 0;

  // 1. Renewal invoices a few days before an active term ends.
  const renewing = await masterPrisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { lte: addDays(now, env.BILLING_RENEWAL_LEAD_DAYS), gt: now }
    },
    include: { plan: true }
  });

  for (const subscription of renewing) {
    if (effectivePriceMinor(subscription.plan, subscription) <= 0) continue;
    const alreadyInvoiced = await masterPrisma.invoice.findFirst({
      where: { schoolId: subscription.schoolId, periodStart: subscription.currentPeriodEnd }
    });
    if (alreadyInvoiced) continue;

    await createInvoice({
      schoolId: subscription.schoolId,
      plan: subscription.plan,
      subscriptionId: subscription.id,
      periodStart: subscription.currentPeriodEnd,
      periodEnd: periodEndFrom(subscription.plan, subscription.currentPeriodEnd),
      couponCode: null,
      notes: "Automatic renewal invoice",
      subscription
    }).then(async (invoice) => {
      renewalsIssued += 1;
      await recordBillingEvent({
        schoolId: subscription.schoolId,
        actor: SYSTEM_ACTOR,
        action: "invoice.renewal_issued",
        message: `Renewal invoice ${invoice.number} issued for ${subscription.plan.name}`
      });
      await notifyInvoiceRaised(invoice, { renewal: true });
    }).catch((err) => logger.error({ err, schoolId: subscription.schoolId }, "Renewal invoice failed"));
  }

  // 2. Reconcile stale orders against the gateway before writing them off.
  // A payment can sit in CREATED because the school abandoned checkout, or
  // because the webhook never arrived and the browser closed before the
  // callback — in the second case the money really did move. Ask the gateway
  // which it was; only mark it failed once the gateway agrees it never paid.
  const stale = await masterPrisma.payment.findMany({
    where: {
      status: PaymentState.CREATED,
      createdAt: { lt: new Date(now.getTime() - CHECKOUT_ORDER_TTL_MS) }
    },
    take: 100
  });

  let recovered = 0;
  let abandoned = 0;

  for (const payment of stale) {
    if (!payment.providerOrderId) continue;
    try {
      const order = await razorpay.fetchOrder(payment.providerOrderId);
      if (order?.status === "paid") {
        const captured = (await razorpay.fetchOrderPayments(payment.providerOrderId)).find(
          (entry) => entry.status === "captured" || entry.status === "authorized"
        );
        if (captured) {
          await applySuccessfulPayment({
            providerOrderId: payment.providerOrderId,
            providerPaymentId: captured.id,
            signature: null,
            method: captured.method ?? "reconciled",
            actor: SYSTEM_ACTOR
          });
          recovered += 1;
          await recordBillingEvent({
            schoolId: payment.schoolId,
            actor: SYSTEM_ACTOR,
            action: "payment.reconciled",
            message: `Recovered a paid order the webhook never delivered (${payment.providerOrderId})`
          });
          continue;
        }
        // Paid at the gateway but no payment we can attribute yet — leave it
        // alone and look again on the next sweep rather than guessing.
        continue;
      }

      await masterPrisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentState.FAILED, failureReason: "Checkout abandoned" }
      });
      abandoned += 1;
    } catch (err) {
      // An unreachable gateway must never turn a real payment into a failure.
      logger.error({ err, orderId: payment.providerOrderId }, "Payment reconciliation failed; leaving it open");
    }
  }

  // 3. Term ended and unpaid → past due, with a grace window before suspension.
  const lapsed = await masterPrisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      currentPeriodEnd: { lte: now }
    },
    include: { plan: true }
  });

  for (const subscription of lapsed) {
    const cancelled = subscription.cancelAtPeriodEnd;
    const updated = await masterPrisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: cancelled ? SubscriptionStatus.CANCELLED : SubscriptionStatus.PAST_DUE,
        gracePeriodEndsAt: cancelled ? null : addDays(now, env.BILLING_GRACE_DAYS)
      },
      include: { plan: true }
    });
    await syncSchoolFromSubscription(updated);
    await recordBillingEvent({
      schoolId: subscription.schoolId,
      actor: SYSTEM_ACTOR,
      action: cancelled ? "subscription.cancelled" : "subscription.past_due",
      message: cancelled
        ? "Subscription cancelled at the end of the term"
        : `Subscription is past due; access ends ${updated.gracePeriodEndsAt?.toISOString()}`
    });
    // A cancellation was the school's own decision; only a lapse needs telling.
    if (!cancelled) await notifyPastDue(updated);
  }

  // 3b. Grace window about to close — the last warning before suspension.
  const graceEnding = await masterPrisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.PAST_DUE,
      gracePeriodEndsAt: { gt: now, lte: addDays(now, GRACE_WARNING_DAYS) }
    },
    include: { plan: true }
  });
  for (const subscription of graceEnding) await notifyGraceEnding(subscription);

  // 4. Grace window elapsed → suspend the tenant.
  const graceOver = await masterPrisma.subscription.findMany({
    where: { status: SubscriptionStatus.PAST_DUE, gracePeriodEndsAt: { lte: now } },
    include: { plan: true }
  });

  for (const subscription of graceOver) {
    const updated = await masterPrisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.EXPIRED, gracePeriodEndsAt: null },
      include: { plan: true }
    });
    await syncSchoolFromSubscription(updated);
    await recordBillingEvent({
      schoolId: subscription.schoolId,
      actor: SYSTEM_ACTOR,
      action: "subscription.expired",
      message: "Grace period ended; school access suspended"
    });
    await notifySuspended(updated);
  }

  return {
    renewalsIssued,
    recoveredPayments: recovered,
    abandonedPayments: abandoned,
    movedToPastDue: lapsed.length,
    expired: graceOver.length
  };
}

const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

export function startSubscriptionWorker() {
  if (env.NODE_ENV === "test" || !env.MASTER_DATABASE_URL || !env.BACKGROUND_WORKERS_ENABLED) return;

  const tick = () =>
    void runSubscriptionMaintenance()
      .then((result) => {
        if (
          result.renewalsIssued ||
          result.recoveredPayments ||
          result.abandonedPayments ||
          result.movedToPastDue ||
          result.expired
        ) {
          logger.warn(result, "Subscription maintenance applied changes");
        }
      })
      .catch((err) => logger.error({ err }, "Subscription maintenance failed"));

  tick();
  const timer = setInterval(tick, MAINTENANCE_INTERVAL_MS);
  timer.unref?.();
}
