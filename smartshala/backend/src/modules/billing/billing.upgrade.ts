/**
 * Student headroom, and buying more of it.
 *
 * The price list is tiered by student count, so the tier a school is on is also
 * the cap on how many students it can hold. This module is the one place that
 * turns "you are full" into "here is what the next tier costs", so the Students
 * screen, the Billing screen and the checkout all quote the same number.
 */
import { InvoiceStatus } from "../../../node_modules/@smartshala/master-client/index.js";
import { AppError } from "../../core/errors.js";
import { prisma } from "../../core/prisma.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { effectivePriceMinor, priceUpgrade, rupeesFromMinor, upgradeForStudents } from "./billing.pricing.js";
import {
  createCheckoutSession,
  createInvoice,
  ensureGatewayOrder,
  ensureSubscription,
  findSubscription,
  getPlanByCodeOrThrow,
  recordBillingEvent,
  type BillingActor
} from "./billing.service.js";
import { razorpay } from "../../services/razorpay/index.js";

function rupees(minor: number) {
  return `₹${rupeesFromMinor(minor).toLocaleString("en-IN")}`;
}

/** Active students are what a tier is measured against; inactive ones are history. */
function countActiveStudents(schoolId: string) {
  return prisma.student.count({ where: { schoolId, isActive: true } });
}

/**
 * Refuse an admission that would take the school past its tier, and hand the
 * caller everything the upgrade prompt needs. Silent when the workspace is not
 * billed through the master registry (legacy single-tenant) or has no
 * subscription row yet — billing must never block admissions by accident.
 */
export async function assertStudentCapacity(user: Express.UserContext, adding = 1) {
  if (!isMasterDbConfigured() || !user.tenantSchoolId) return;

  const subscription = await findSubscription(user.tenantSchoolId);
  if (!subscription) return;

  const maxStudents = subscription.plan.maxStudents;
  if (maxStudents === null) return;

  const students = await countActiveStudents(user.schoolId);
  if (students + adding <= maxStudents) return;

  const upgrade = await upgradeForStudents(subscription, students + adding);
  const headroom = Math.max(0, maxStudents - students);
  const ask =
    upgrade === null
      ? "Contact SmartShala to raise your student limit."
      : upgrade.selfServe
        ? `Upgrade to ${upgrade.planName} (${upgrade.maxStudents === null ? "no student limit" : `up to ${upgrade.maxStudents.toLocaleString("en-IN")} students`}) for ${rupees(upgrade.subtotalMinor)} + GST to admit more.`
        : `${upgrade.note}`;

  throw new AppError(
    409,
    `Your ${subscription.plan.name} plan covers ${maxStudents.toLocaleString("en-IN")} students and you have ${students.toLocaleString("en-IN")}` +
      `${adding > 1 ? `, so there is room for ${headroom.toLocaleString("en-IN")} more of these ${adding.toLocaleString("en-IN")}` : ""}. ${ask}`,
    "PLAN_STUDENT_LIMIT_REACHED",
    {
      students,
      adding,
      maxStudents,
      plan: { code: subscription.plan.code, name: subscription.plan.name },
      upgrade
    }
  );
}

/**
 * Checkout for moving up a tier. Mid-term it bills only the difference between
 * the two plans and leaves the renewal date alone, so paying it swaps the plan
 * without buying a second term. Off a paid term there is no difference to bill,
 * so it falls through to the ordinary full-price checkout.
 */
export async function createUpgradeCheckout(input: { schoolId: string; planCode: string; actor: BillingActor }) {
  const subscription = await ensureSubscription(input.schoolId);
  const plan = await getPlanByCodeOrThrow(input.planCode);
  if (!plan.isActive) throw new AppError(409, "That plan is no longer available", "PLAN_INACTIVE");

  const currentMinor = effectivePriceMinor(subscription.plan, subscription);
  if (plan.priceMinor <= currentMinor) {
    throw new AppError(400, "That plan is not an upgrade. Contact SmartShala to change plan.", "PLAN_NOT_AN_UPGRADE");
  }

  const option = priceUpgrade(subscription, plan);
  if (!option.selfServe) throw new AppError(409, option.note!, "PLAN_NOT_SELF_SERVE");
  if (!option.chargesDifferenceOnly) {
    return createCheckoutSession({ schoolId: input.schoolId, planCode: plan.code, couponCode: null, actor: input.actor });
  }

  // A renewal invoice for the next term is raised a few days before this one
  // ends, and it is priced for the plan the school is on today. Paying it after
  // an upgrade would move the subscription straight back down, so the renewal
  // has to be settled first and the upgrade applied to the term it buys.
  const pendingRenewal = await masterPrisma.invoice.findFirst({
    where: {
      schoolId: input.schoolId,
      status: InvoiceStatus.DUE,
      periodStart: { gte: subscription.currentPeriodEnd }
    }
  });
  if (pendingRenewal) {
    throw new AppError(
      409,
      `Settle renewal invoice ${pendingRenewal.number} first, then upgrade — otherwise the renewal would put you back on ${subscription.plan.name}.`,
      "RENEWAL_INVOICE_OPEN"
    );
  }

  // Reopening the page or double-clicking Upgrade must not stack a second due
  // invoice for the same move.
  const existing = await masterPrisma.invoice.findFirst({
    where: {
      schoolId: input.schoolId,
      status: InvoiceStatus.DUE,
      planCode: plan.code,
      totalMinor: option.totalMinor,
      periodEnd: option.periodEnd
    },
    orderBy: { issuedAt: "desc" }
  });

  const invoice =
    existing ??
    (await createInvoice({
      schoolId: input.schoolId,
      plan,
      subscriptionId: subscription.id,
      periodStart: option.periodStart,
      periodEnd: option.periodEnd,
      couponCode: null,
      notes: `Upgrade from ${subscription.plan.name} to ${plan.name} — difference for the term ending ${option.periodEnd.toISOString().slice(0, 10)}`,
      // Bills the gap rather than the new plan's full price, through the same
      // path a negotiated rate takes.
      subscription: { customPriceMinor: option.subtotalMinor }
    }));

  const { order, payment, amountDue } = await ensureGatewayOrder(invoice);

  await recordBillingEvent({
    schoolId: input.schoolId,
    actor: input.actor,
    action: "checkout.upgrade_created",
    message: `Upgrade checkout started: ${subscription.plan.name} → ${plan.name} (${invoice.number}) — INR ${rupeesFromMinor(amountDue)}`,
    metadata: { invoiceId: invoice.id, orderId: order.id, fromPlan: subscription.plan.code, toPlan: plan.code }
  });

  const school = await masterPrisma.school.findUniqueOrThrow({ where: { schoolId: input.schoolId } });

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
