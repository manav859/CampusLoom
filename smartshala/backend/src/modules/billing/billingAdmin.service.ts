import {
  GatewayMode,
  InvoiceStatus,
  PaymentState,
  Prisma,
  SubscriptionStatus,
  TenantDeletionStatus
} from "../../../node_modules/@smartshala/master-client/index.js";
import type { BillingInterval, DiscountType } from "../../../node_modules/@smartshala/master-client/index.js";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../core/errors.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { razorpay } from "../../services/razorpay/index.js";
import { getTenantPrismaClient } from "../../tenant/prismaManager.js";
import { addDays, effectivePriceMinor, periodEndFrom, rupeesFromMinor } from "./billing.pricing.js";
import {
  createInvoice,
  ensureSubscription,
  findSubscription,
  getPlanByCodeOrThrow,
  recordBillingEvent,
  syncSchoolFromSubscription
} from "./billing.service.js";
import type { BillingActor } from "./billing.service.js";
import { listSchoolNotifications, notifyInvoiceRaised, notifyPaymentReceived } from "./billing.notifications.js";

export const SUPER_ADMIN_ACTOR: BillingActor = { kind: "SUPER_ADMIN", label: "super-admin" };

function assertMaster() {
  if (!isMasterDbConfigured()) {
    throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }
}

// --- Plan catalogue ----------------------------------------------------------

export type PlanInput = {
  code: string;
  name: string;
  description?: string | null;
  priceRupees: number;
  currency?: string;
  interval: BillingInterval;
  intervalCount?: number;
  trialDays?: number;
  maxStudents?: number | null;
  maxStaff?: number | null;
  features?: Record<string, boolean>;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
};

export async function listAllPlans() {
  assertMaster();
  const plans = await masterPrisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { priceMinor: "asc" }] });
  const counts = await masterPrisma.subscription.groupBy({ by: ["planId"], _count: { _all: true } });
  const byPlan = new Map(counts.map((row) => [row.planId, row._count._all]));
  return plans.map((plan) => ({ ...plan, subscriberCount: byPlan.get(plan.id) ?? 0 }));
}

export async function createPlan(input: PlanInput) {
  assertMaster();
  const code = input.code.trim().toUpperCase();
  const existing = await masterPrisma.plan.findUnique({ where: { code } });
  if (existing) throw new AppError(409, `A plan with code ${code} already exists`, "PLAN_CODE_TAKEN");

  const plan = await masterPrisma.plan.create({
    data: {
      code,
      name: input.name.trim(),
      description: input.description ?? null,
      priceMinor: Math.round(input.priceRupees * 100),
      currency: input.currency ?? "INR",
      interval: input.interval,
      intervalCount: input.intervalCount ?? 1,
      trialDays: input.trialDays ?? 0,
      maxStudents: input.maxStudents ?? null,
      maxStaff: input.maxStaff ?? null,
      features: (input.features ?? {}) as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
      isPublic: input.isPublic ?? true,
      sortOrder: input.sortOrder ?? 0
    }
  });

  await recordBillingEvent({
    actor: SUPER_ADMIN_ACTOR,
    action: "plan.created",
    message: `Plan ${plan.code} created at INR ${rupeesFromMinor(plan.priceMinor)} / ${plan.interval.toLowerCase()}`
  });
  return plan;
}

export async function updatePlan(planId: string, input: Partial<PlanInput>) {
  assertMaster();
  const plan = await masterPrisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, "Plan not found", "PLAN_NOT_FOUND");

  const updated = await masterPrisma.plan.update({
    where: { id: planId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priceRupees !== undefined ? { priceMinor: Math.round(input.priceRupees * 100) } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.interval !== undefined ? { interval: input.interval } : {}),
      ...(input.intervalCount !== undefined ? { intervalCount: input.intervalCount } : {}),
      ...(input.trialDays !== undefined ? { trialDays: input.trialDays } : {}),
      ...(input.maxStudents !== undefined ? { maxStudents: input.maxStudents } : {}),
      ...(input.maxStaff !== undefined ? { maxStaff: input.maxStaff } : {}),
      ...(input.features !== undefined ? { features: input.features as Prisma.InputJsonValue } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
    }
  });

  await recordBillingEvent({
    actor: SUPER_ADMIN_ACTOR,
    action: "plan.updated",
    message: `Plan ${updated.code} updated`,
    metadata: { before: { priceMinor: plan.priceMinor, isActive: plan.isActive }, after: { priceMinor: updated.priceMinor, isActive: updated.isActive } }
  });
  return updated;
}

/** A plan with subscribers is archived rather than deleted so invoices keep their link. */
export async function archivePlan(planId: string) {
  assertMaster();
  const plan = await masterPrisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, "Plan not found", "PLAN_NOT_FOUND");

  const subscribers = await masterPrisma.subscription.count({ where: { planId } });
  if (subscribers === 0) {
    const invoices = await masterPrisma.invoice.count({ where: { planId } });
    if (invoices === 0) {
      await masterPrisma.plan.delete({ where: { id: planId } });
      await recordBillingEvent({ actor: SUPER_ADMIN_ACTOR, action: "plan.deleted", message: `Plan ${plan.code} deleted` });
      return { deleted: true as const, plan };
    }
  }

  const archived = await masterPrisma.plan.update({
    where: { id: planId },
    data: { isActive: false, isPublic: false }
  });
  await recordBillingEvent({
    actor: SUPER_ADMIN_ACTOR,
    action: "plan.archived",
    message: `Plan ${plan.code} archived (${subscribers} subscriber${subscribers === 1 ? "" : "s"} kept)`
  });
  return { deleted: false as const, plan: archived };
}

// --- Coupons -----------------------------------------------------------------

export type CouponInput = {
  code: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxRedemptions?: number | null;
  isActive?: boolean;
  expiresAt?: string | null;
};

export async function listCoupons() {
  assertMaster();
  return masterPrisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createCoupon(input: CouponInput) {
  assertMaster();
  const code = input.code.trim().toUpperCase();
  const existing = await masterPrisma.coupon.findUnique({ where: { code } });
  if (existing) throw new AppError(409, `Coupon ${code} already exists`, "COUPON_CODE_TAKEN");

  const coupon = await masterPrisma.coupon.create({
    data: {
      code,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: new Prisma.Decimal(input.discountValue),
      maxRedemptions: input.maxRedemptions ?? null,
      isActive: input.isActive ?? true,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });
  await recordBillingEvent({ actor: SUPER_ADMIN_ACTOR, action: "coupon.created", message: `Coupon ${code} created` });
  return coupon;
}

export async function updateCoupon(couponId: string, input: Partial<CouponInput>) {
  assertMaster();
  const coupon = await masterPrisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new AppError(404, "Coupon not found", "COUPON_NOT_FOUND");

  const updated = await masterPrisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
      ...(input.discountValue !== undefined ? { discountValue: new Prisma.Decimal(input.discountValue) } : {}),
      ...(input.maxRedemptions !== undefined ? { maxRedemptions: input.maxRedemptions } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {})
    }
  });
  await recordBillingEvent({ actor: SUPER_ADMIN_ACTOR, action: "coupon.updated", message: `Coupon ${updated.code} updated` });
  return updated;
}

export async function deleteCoupon(couponId: string) {
  assertMaster();
  const coupon = await masterPrisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new AppError(404, "Coupon not found", "COUPON_NOT_FOUND");
  await masterPrisma.coupon.delete({ where: { id: couponId } });
  await recordBillingEvent({ actor: SUPER_ADMIN_ACTOR, action: "coupon.deleted", message: `Coupon ${coupon.code} deleted` });
  return { deleted: true };
}

// --- Subscriptions across all tenants ---------------------------------------

export async function listSubscriptions(filter: { status?: SubscriptionStatus; planCode?: string; query?: string }) {
  assertMaster();
  const subscriptions = await masterPrisma.subscription.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.planCode ? { plan: { code: filter.planCode } } : {}),
      school: { deletionStatus: { not: TenantDeletionStatus.DELETED } }
    },
    include: {
      plan: true,
      school: { select: { schoolId: true, schoolName: true, ownerName: true, email: true, phone: true, isActive: true } }
    },
    orderBy: { currentPeriodEnd: "asc" }
  });

  const text = filter.query?.trim().toLowerCase();
  if (!text) return subscriptions;
  return subscriptions.filter((row) =>
    [row.school.schoolId, row.school.schoolName, row.school.email, row.plan.code]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(text))
  );
}

export async function getSchoolBilling(schoolId: string) {
  assertMaster();
  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");

  const subscription = await ensureSubscription(schoolId);
  const [invoices, events, usage, notifications] = await Promise.all([
    masterPrisma.invoice.findMany({
      where: { schoolId },
      orderBy: { issuedAt: "desc" },
      take: 100,
      include: { payments: { orderBy: { createdAt: "desc" } } }
    }),
    masterPrisma.billingEvent.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 50 }),
    getSchoolUsage(schoolId),
    listSchoolNotifications(schoolId)
  ]);

  return {
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      ownerName: school.ownerName,
      email: school.email,
      phone: school.phone,
      isActive: school.isActive,
      numberOfStudents: school.numberOfStudents,
      numberOfStaff: school.numberOfStaff,
      address: school.address,
      gstin: school.gstin,
      stateName: school.stateName,
      stateCode: school.stateCode
    },
    subscription,
    pricing: {
      listPriceMinor: subscription.plan.priceMinor,
      effectivePriceMinor: effectivePriceMinor(subscription.plan, subscription),
      isCustomPrice: subscription.customPriceMinor !== null,
      customPriceNote: subscription.customPriceNote
    },
    usage: {
      ...usage,
      maxStudents: subscription.plan.maxStudents,
      maxStaff: subscription.plan.maxStaff
    },
    invoices,
    events,
    notifications,
    gateway: { mode: razorpay.mode }
  };
}

export async function changeSchoolPlan(input: {
  schoolId: string;
  planCode: string;
  /** Start a fresh term now instead of keeping the current period dates. */
  restartPeriod: boolean;
  status?: SubscriptionStatus;
  reason?: string;
  /**
   * Negotiated rate to carry onto the new plan. Undefined clears any existing
   * override, so a plan change defaults back to list price rather than silently
   * keeping a rate that was agreed for a different plan.
   */
  customPriceRupees?: number | null;
  /** Skip the plan-size check when the downgrade is deliberate. */
  force?: boolean;
}) {
  assertMaster();
  const plan = await getPlanByCodeOrThrow(input.planCode);
  const current = await ensureSubscription(input.schoolId);

  // Refuse a downgrade the school does not fit into, unless it is forced. Left
  // unchecked this silently puts a school over its own plan on day one.
  if (!input.force && (plan.maxStudents !== null || plan.maxStaff !== null)) {
    const usage = await getSchoolUsage(input.schoolId);
    const over: string[] = [];
    if (plan.maxStudents !== null && usage.students !== null && usage.students > plan.maxStudents) {
      over.push(`${usage.students} students against a limit of ${plan.maxStudents}`);
    }
    if (plan.maxStaff !== null && usage.staff !== null && usage.staff > plan.maxStaff) {
      over.push(`${usage.staff} staff against a limit of ${plan.maxStaff}`);
    }
    if (over.length) {
      throw new AppError(
        409,
        `${plan.name} is too small for this school: ${over.join(" and ")}. Re-send with force to override.`,
        "PLAN_TOO_SMALL",
        { over, planCode: plan.code }
      );
    }
  }

  const now = new Date();
  const periodStart = input.restartPeriod ? now : current.currentPeriodStart;
  const periodEnd = input.restartPeriod ? periodEndFrom(plan, now) : current.currentPeriodEnd;
  const customPriceMinor =
    input.customPriceRupees === undefined || input.customPriceRupees === null
      ? null
      : Math.round(input.customPriceRupees * 100);
  const priceMinor = customPriceMinor ?? plan.priceMinor;

  const updated = await masterPrisma.subscription.update({
    where: { schoolId: input.schoolId },
    data: {
      planId: plan.id,
      status: input.status ?? (priceMinor === 0 ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gracePeriodEndsAt: null,
      customPriceMinor,
      customPriceNote: customPriceMinor === null ? null : (input.reason ?? current.customPriceNote)
    },
    include: { plan: true }
  });
  await syncSchoolFromSubscription(updated);

  const priceNote =
    customPriceMinor === null
      ? current.customPriceMinor === null
        ? ""
        : " (custom price cleared, back to list price)"
      : ` at a negotiated INR ${rupeesFromMinor(customPriceMinor)}`;

  await recordBillingEvent({
    schoolId: input.schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "subscription.plan_changed",
    message: `Plan changed ${current.plan.code} → ${plan.code}${priceNote}${input.reason ? ` (${input.reason})` : ""}`
  });
  return updated;
}

export async function extendSubscription(schoolId: string, days: number, reason?: string) {
  assertMaster();
  const subscription = await ensureSubscription(schoolId);
  const now = new Date();
  const base = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;

  const updated = await masterPrisma.subscription.update({
    where: { schoolId },
    data: {
      currentPeriodEnd: addDays(base, days),
      status:
        subscription.status === SubscriptionStatus.EXPIRED || subscription.status === SubscriptionStatus.PAST_DUE
          ? subscription.plan.priceMinor === 0
            ? SubscriptionStatus.TRIALING
            : SubscriptionStatus.ACTIVE
          : subscription.status,
      gracePeriodEndsAt: null
    },
    include: { plan: true }
  });
  await syncSchoolFromSubscription(updated);

  await recordBillingEvent({
    schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "subscription.extended",
    message: `Access extended by ${days} day${days === 1 ? "" : "s"}${reason ? ` (${reason})` : ""}`
  });
  return updated;
}

export async function setSubscriptionStatus(schoolId: string, status: SubscriptionStatus, reason?: string) {
  assertMaster();
  await ensureSubscription(schoolId);
  const updated = await masterPrisma.subscription.update({
    where: { schoolId },
    data: {
      status,
      gracePeriodEndsAt: status === SubscriptionStatus.PAST_DUE ? addDays(new Date(), 7) : null,
      cancelledAt: status === SubscriptionStatus.CANCELLED ? new Date() : null
    },
    include: { plan: true }
  });
  await syncSchoolFromSubscription(updated);

  await recordBillingEvent({
    schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "subscription.status_changed",
    message: `Subscription status set to ${status}${reason ? ` (${reason})` : ""}`
  });
  return updated;
}

// --- Invoice operations ------------------------------------------------------

export async function createManualInvoice(input: {
  schoolId: string;
  planCode: string;
  couponCode?: string | null;
  notes?: string | null;
}) {
  assertMaster();
  const plan = await getPlanByCodeOrThrow(input.planCode);
  const subscription = await ensureSubscription(input.schoolId);
  const now = new Date();
  const periodStart = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;

  const invoice = await createInvoice({
    schoolId: input.schoolId,
    plan,
    subscriptionId: subscription.id,
    periodStart,
    periodEnd: periodEndFrom(plan, periodStart),
    couponCode: input.couponCode,
    notes: input.notes ?? "Raised by super admin",
    subscription
  });

  await recordBillingEvent({
    schoolId: input.schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "invoice.created",
    message: `Invoice ${invoice.number} raised for ${plan.name} — INR ${rupeesFromMinor(invoice.totalMinor)}`
  });
  await notifyInvoiceRaised(invoice, { renewal: false });
  return invoice;
}

/** Records an offline settlement (NEFT, cheque, cash) against an open invoice. */
export async function markInvoicePaidOffline(input: { invoiceId: string; method: string; reference?: string | null }) {
  assertMaster();
  const invoice = await masterPrisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");
  if (invoice.status === InvoiceStatus.PAID) throw new AppError(409, "Invoice is already paid", "INVOICE_ALREADY_PAID");
  if (invoice.status === InvoiceStatus.VOID) throw new AppError(409, "Invoice is void", "INVOICE_VOID");

  const outstanding = invoice.totalMinor - invoice.amountPaidMinor;
  const now = new Date();
  const plan = invoice.planId ? await masterPrisma.plan.findUnique({ where: { id: invoice.planId } }) : null;

  await masterPrisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        schoolId: invoice.schoolId,
        provider: "offline",
        gatewayMode: GatewayMode.MOCK,
        providerPaymentId: `offline_${invoice.number}_${now.getTime()}`,
        status: PaymentState.CAPTURED,
        amountMinor: outstanding,
        currency: invoice.currency,
        method: input.method,
        capturedAt: now,
        notes: { reference: input.reference ?? null, recordedBy: "super-admin" }
      }
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaidMinor: invoice.totalMinor, status: InvoiceStatus.PAID, paidAt: now }
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
          cancelledAt: null
        }
      });
    }
  });

  const subscription = await findSubscription(invoice.schoolId);
  if (subscription) await syncSchoolFromSubscription(subscription);

  await recordBillingEvent({
    schoolId: invoice.schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "invoice.paid_offline",
    message: `Invoice ${invoice.number} settled offline via ${input.method} — INR ${rupeesFromMinor(outstanding)}`,
    metadata: { reference: input.reference ?? null }
  });

  await notifyPaymentReceived(invoice, outstanding);

  return masterPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
}

export async function voidInvoice(invoiceId: string, reason: string) {
  assertMaster();
  const invoice = await masterPrisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");
  if (invoice.status === InvoiceStatus.PAID) {
    throw new AppError(409, "A paid invoice cannot be voided — issue a refund instead", "INVOICE_ALREADY_PAID");
  }

  const updated = await masterPrisma.$transaction(async (tx) => {
    // A voided invoice never consumed its coupon either.
    if (invoice.couponCode) {
      await tx.coupon.updateMany({
        where: { code: invoice.couponCode, redeemedCount: { gt: 0 } },
        data: { redeemedCount: { decrement: 1 } }
      });
    }
    return tx.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID, voidedAt: new Date(), notes: reason }
    });
  });
  await recordBillingEvent({
    schoolId: invoice.schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "invoice.voided",
    message: `Invoice ${invoice.number} voided: ${reason}`
  });
  return updated;
}

export async function refundPayment(input: { paymentId: string; amountRupees?: number; reason: string }) {
  assertMaster();
  const payment = await masterPrisma.payment.findUnique({ where: { id: input.paymentId }, include: { invoice: true } });
  if (!payment) throw new AppError(404, "Payment not found", "PAYMENT_NOT_FOUND");
  if (payment.status !== PaymentState.CAPTURED) {
    throw new AppError(409, "Only a captured payment can be refunded", "PAYMENT_NOT_CAPTURED");
  }

  const refundable = payment.amountMinor - payment.refundedMinor;
  const amountMinor = input.amountRupees !== undefined ? Math.round(input.amountRupees * 100) : refundable;
  if (amountMinor <= 0 || amountMinor > refundable) {
    throw new AppError(400, `Refund must be between INR 1 and INR ${rupeesFromMinor(refundable)}`, "REFUND_AMOUNT_INVALID");
  }

  const refund = payment.providerPaymentId
    ? await razorpay.refund(payment.providerPaymentId, amountMinor)
    : { id: `offline_refund_${Date.now()}` };

  const refundedMinor = payment.refundedMinor + amountMinor;
  await masterPrisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedMinor,
        refundReference: refund.id,
        status: refundedMinor >= payment.amountMinor ? PaymentState.REFUNDED : PaymentState.CAPTURED
      }
    });

    const invoicePaid = payment.invoice.amountPaidMinor - amountMinor;
    const fullyRefunded = invoicePaid <= 0;

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        amountPaidMinor: Math.max(0, invoicePaid),
        status: fullyRefunded ? InvoiceStatus.REFUNDED : payment.invoice.status
      }
    });

    if (fullyRefunded) {
      // Refunding the money has to take back what the money bought, otherwise
      // the school keeps the term it no longer paid for. Drop to PAST_DUE with
      // the standard grace window rather than cutting access off mid-lesson.
      await tx.subscription.updateMany({
        where: { schoolId: payment.schoolId, status: SubscriptionStatus.ACTIVE },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          gracePeriodEndsAt: addDays(new Date(), env.BILLING_GRACE_DAYS)
        }
      });

      // A refunded order never really consumed its coupon.
      if (payment.invoice.couponCode) {
        await tx.coupon.updateMany({
          where: { code: payment.invoice.couponCode, redeemedCount: { gt: 0 } },
          data: { redeemedCount: { decrement: 1 } }
        });
      }
    }
  });

  const subscription = await findSubscription(payment.schoolId);
  if (subscription) await syncSchoolFromSubscription(subscription);

  await recordBillingEvent({
    schoolId: payment.schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "payment.refunded",
    message: `Refunded INR ${rupeesFromMinor(amountMinor)} on ${payment.invoice.number}: ${input.reason}`,
    metadata: { refundReference: refund.id }
  });

  return masterPrisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { invoice: true } });
}

// --- Revenue summary ---------------------------------------------------------

export async function getRevenueSummary() {
  assertMaster();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [statusCounts, subscriptions, paidAgg, monthAgg, outstandingAgg, recentEvents] = await Promise.all([
    masterPrisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    masterPrisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true }
    }),
    masterPrisma.invoice.aggregate({ where: { status: InvoiceStatus.PAID }, _sum: { amountPaidMinor: true } }),
    masterPrisma.invoice.aggregate({
      where: { status: InvoiceStatus.PAID, paidAt: { gte: monthStart } },
      _sum: { amountPaidMinor: true }
    }),
    masterPrisma.invoice.aggregate({
      where: { status: InvoiceStatus.DUE },
      _sum: { totalMinor: true, amountPaidMinor: true },
      _count: { _all: true }
    }),
    masterPrisma.billingEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 })
  ]);

  // Normalise every active plan to a monthly figure so MRR is comparable.
  const mrrMinor = subscriptions.reduce((sum, row) => {
    const months = row.plan.interval === "YEAR" ? 12 * row.plan.intervalCount : row.plan.intervalCount;
    return sum + Math.round(effectivePriceMinor(row.plan, row) / Math.max(1, months));
  }, 0);

  const expiringSoon = await masterPrisma.subscription.count({
    where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }, currentPeriodEnd: { lte: addDays(now, 14), gt: now } }
  });

  return {
    statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
    mrrMinor,
    arrMinor: mrrMinor * 12,
    lifetimeCollectedMinor: paidAgg._sum.amountPaidMinor ?? 0,
    collectedThisMonthMinor: monthAgg._sum.amountPaidMinor ?? 0,
    outstandingMinor: (outstandingAgg._sum.totalMinor ?? 0) - (outstandingAgg._sum.amountPaidMinor ?? 0),
    outstandingInvoiceCount: outstandingAgg._count._all,
    expiringSoon,
    recentEvents,
    gateway: { mode: razorpay.mode }
  };
}

export async function listAllInvoices(filter: { status?: InvoiceStatus; schoolId?: string; take?: number }) {
  assertMaster();
  return masterPrisma.invoice.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.schoolId ? { schoolId: filter.schoolId } : {})
    },
    orderBy: { issuedAt: "desc" },
    take: filter.take ?? 100,
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      school: { select: { schoolName: true } }
    }
  });
}

// --- Access control (used by the legacy super admin grant/revoke buttons) ----

/**
 * "Grant access" in the super admin panel. A term still running is simply
 * reactivated; a lapsed one starts fresh — trialDays for a free plan, a full
 * comped period for a paid one, which the billing event records as such.
 */
export async function grantAccess(schoolId: string) {
  assertMaster();
  const subscription = await ensureSubscription(schoolId);
  const now = new Date();
  const free = subscription.plan.priceMinor === 0;
  const termLive = subscription.currentPeriodEnd > now;

  const periodStart = termLive ? subscription.currentPeriodStart : now;
  const periodEnd = termLive
    ? subscription.currentPeriodEnd
    : free
      ? addDays(now, subscription.plan.trialDays || 30)
      : periodEndFrom(subscription.plan, now);

  const updated = await masterPrisma.subscription.update({
    where: { schoolId },
    data: {
      status: free ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gracePeriodEndsAt: null,
      cancelledAt: null
    },
    include: { plan: true }
  });
  await syncSchoolFromSubscription(updated);

  await recordBillingEvent({
    schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "access.granted",
    message: termLive
      ? "Access restored for the running term"
      : `Access granted with a new ${free ? "trial" : "comped"} term ending ${periodEnd.toISOString()}`
  });
  return updated;
}

/** "Revoke access" — an administrative suspension, distinct from a lapse. */
export async function revokeAccess(schoolId: string, reason = "Revoked by super admin") {
  assertMaster();
  await ensureSubscription(schoolId);
  const updated = await masterPrisma.subscription.update({
    where: { schoolId },
    data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date(), gracePeriodEndsAt: null },
    include: { plan: true }
  });
  await syncSchoolFromSubscription(updated);
  await recordBillingEvent({ schoolId, actor: SUPER_ADMIN_ACTOR, action: "access.revoked", message: reason });
  return updated;
}

/**
 * Called at the end of onboarding so a brand-new school already has a plan and,
 * for a paid signup, an invoice waiting for it the moment it is approved.
 */
export async function bootstrapSubscription(input: {
  schoolId: string;
  planCode: string;
  couponCode?: string | null;
}) {
  assertMaster();
  const plan = await getPlanByCodeOrThrow(input.planCode);
  const now = new Date();

  // The term is deliberately zero-length: the clock starts when the super admin
  // approves the school, not while it sits in the queue.
  const subscription = await masterPrisma.subscription.create({
    data: {
      schoolId: input.schoolId,
      planId: plan.id,
      status: plan.priceMinor === 0 ? SubscriptionStatus.TRIALING : SubscriptionStatus.PAST_DUE,
      currentPeriodStart: now,
      currentPeriodEnd: now,
      couponCode: input.couponCode ?? null
    },
    include: { plan: true }
  });

  if (plan.priceMinor > 0) {
    await createInvoice({
      schoolId: input.schoolId,
      plan,
      subscriptionId: subscription.id,
      periodStart: now,
      periodEnd: periodEndFrom(plan, now),
      couponCode: input.couponCode,
      notes: "Issued at signup"
    }).catch(() => undefined);
  }

  await recordBillingEvent({
    schoolId: input.schoolId,
    actor: { kind: "SYSTEM", label: "onboarding" },
    action: "subscription.created",
    message: `Signed up on ${plan.name}`
  });

  return subscription;
}

// --- Negotiated pricing ------------------------------------------------------

/**
 * Set or clear this school's negotiated rate. Every school bills at its plan's
 * list price by default; this is the escape hatch for a deal that was agreed
 * separately. Passing null returns the school to list price.
 *
 * The change applies to invoices raised from now on. Invoices already issued
 * keep the amount they were issued at — repricing history would make the ledger
 * disagree with what the school was actually asked to pay.
 */
export async function setCustomPrice(input: {
  schoolId: string;
  priceRupees: number | null;
  note?: string | null;
}) {
  assertMaster();
  const subscription = await ensureSubscription(input.schoolId);
  const customPriceMinor = input.priceRupees === null ? null : Math.round(input.priceRupees * 100);

  const updated = await masterPrisma.subscription.update({
    where: { schoolId: input.schoolId },
    data: {
      customPriceMinor,
      customPriceNote: customPriceMinor === null ? null : (input.note ?? null)
    },
    include: { plan: true }
  });

  const openInvoices = await masterPrisma.invoice.count({
    where: { schoolId: input.schoolId, status: InvoiceStatus.DUE }
  });

  await recordBillingEvent({
    schoolId: input.schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: customPriceMinor === null ? "subscription.custom_price_cleared" : "subscription.custom_price_set",
    message:
      customPriceMinor === null
        ? `Custom price cleared; back to ${updated.plan.name} list price of INR ${rupeesFromMinor(updated.plan.priceMinor)}`
        : `Custom price set to INR ${rupeesFromMinor(customPriceMinor)} per ${updated.plan.interval.toLowerCase()} (list is INR ${rupeesFromMinor(updated.plan.priceMinor)})${input.note ? ` — ${input.note}` : ""}`,
    metadata: { previousMinor: subscription.customPriceMinor, newMinor: customPriceMinor }
  });

  return {
    subscription: updated,
    effectivePriceMinor: effectivePriceMinor(updated.plan, updated),
    listPriceMinor: updated.plan.priceMinor,
    // An invoice already raised keeps its old amount, so say so plainly rather
    // than letting the super admin assume the new rate applied retroactively.
    openInvoicesUnchanged: openInvoices
  };
}

/**
 * The school's GST identity. It only ever appears on the tax invoice, so it is
 * kept off the school's own settings — the super admin owns what a filed
 * document says.
 */
export async function setSchoolTaxDetails(input: {
  schoolId: string;
  gstin: string | null;
  stateName: string | null;
  stateCode: string | null;
}) {
  assertMaster();
  const school = await masterPrisma.school.findUnique({ where: { schoolId: input.schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");

  const updated = await masterPrisma.school.update({
    where: { schoolId: input.schoolId },
    data: { gstin: input.gstin, stateName: input.stateName, stateCode: input.stateCode }
  });

  await recordBillingEvent({
    schoolId: input.schoolId,
    actor: SUPER_ADMIN_ACTOR,
    action: "school.tax_details_updated",
    message: `Tax details set — GSTIN ${input.gstin ?? "unregistered"}, state ${input.stateName ?? "-"} (${input.stateCode ?? "-"})`,
    metadata: { previousGstin: school.gstin, previousStateCode: school.stateCode }
  });

  return { gstin: updated.gstin, stateName: updated.stateName, stateCode: updated.stateCode };
}

/**
 * How many students and staff a school actually has, read from its own
 * database. The super admin decides upgrades, so it needs the same numbers the
 * principal sees on the subscription page.
 */
export async function getSchoolUsage(schoolId: string) {
  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");

  try {
    const tenantPrisma = getTenantPrismaClient(school.dbUrl);
    const [students, staff] = await Promise.all([
      tenantPrisma.student.count({ where: { isActive: true } }),
      tenantPrisma.user.count({
        where: { isActive: true, role: { in: [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT] } }
      })
    ]);
    return { students, staff, reachable: true as const };
  } catch (error) {
    // A sleeping or unreachable tenant database must not break the billing
    // screen — report it instead of failing the whole request.
    logger.warn({ err: error, schoolId }, "Could not read tenant usage for billing");
    return { students: null, staff: null, reachable: false as const };
  }
}
