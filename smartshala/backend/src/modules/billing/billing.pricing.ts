import { DiscountType } from "../../../node_modules/@smartshala/master-client/index.js";
import type { Coupon, Plan } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";

export type Quote = {
  planCode: string;
  planName: string;
  currency: string;
  subtotalMinor: number;
  /** The plan's list price, so the UI can show what a custom rate replaced. */
  listPriceMinor: number;
  isCustomPrice: boolean;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxPercent: number;
  couponCode: string | null;
  couponValid: boolean;
  couponMessage: string;
};

export function rupeesFromMinor(minor: number) {
  return Math.round(minor) / 100;
}

export function minorFromRupees(rupees: number) {
  return Math.round(rupees * 100);
}

type CouponCheck = { coupon: Coupon | null; valid: boolean; message: string };

export async function loadCoupon(code?: string | null): Promise<CouponCheck> {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return { coupon: null, valid: true, message: "No coupon applied" };

  const coupon = await masterPrisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.isActive) return { coupon: null, valid: false, message: "Coupon is invalid" };
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    return { coupon: null, valid: false, message: "Coupon has expired" };
  }
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
    return { coupon: null, valid: false, message: "Coupon has reached its redemption limit" };
  }

  return { coupon, valid: true, message: `Coupon ${normalized} applied` };
}

export function discountMinorFor(coupon: Coupon | null, subtotalMinor: number) {
  if (!coupon) return 0;
  const value = Number(coupon.discountValue);
  const raw =
    coupon.discountType === DiscountType.PERCENTAGE
      ? Math.round((subtotalMinor * value) / 100)
      : minorFromRupees(value);
  return Math.max(0, Math.min(subtotalMinor, raw));
}

/**
 * Price a plan for one billing period. Tax is applied after the discount, which
 * is how GST works on a discounted invoice value.
 */
/**
 * What a school actually pays for a plan: its negotiated rate if one is set,
 * otherwise the plan's list price. Every price decision goes through here so a
 * custom rate cannot be honoured in one code path and missed in another.
 */
export function effectivePriceMinor(
  plan: Pick<Plan, "priceMinor">,
  subscription?: { customPriceMinor: number | null } | null
) {
  return subscription?.customPriceMinor ?? plan.priceMinor;
}

export async function quotePlan(
  plan: Plan,
  couponCode?: string | null,
  subscription?: { customPriceMinor: number | null } | null
): Promise<Quote> {
  const { coupon, valid, message } = await loadCoupon(couponCode);
  const subtotalMinor = effectivePriceMinor(plan, subscription);
  const discountMinor = discountMinorFor(coupon, subtotalMinor);
  const taxable = subtotalMinor - discountMinor;
  const taxPercent = subtotalMinor === 0 ? 0 : env.BILLING_TAX_PERCENT;
  const taxMinor = Math.round((taxable * taxPercent) / 100);

  return {
    planCode: plan.code,
    planName: plan.name,
    currency: plan.currency,
    subtotalMinor,
    listPriceMinor: plan.priceMinor,
    isCustomPrice: subtotalMinor !== plan.priceMinor,
    discountMinor,
    taxMinor,
    totalMinor: taxable + taxMinor,
    taxPercent,
    couponCode: coupon?.code ?? (couponCode?.trim().toUpperCase() || null),
    couponValid: valid,
    couponMessage: message
  };
}

/** Advance a date by one plan period (used for both new terms and renewals). */
export function periodEndFrom(plan: Pick<Plan, "interval" | "intervalCount">, start: Date) {
  const end = new Date(start);
  if (plan.interval === "MONTH") end.setMonth(end.getMonth() + plan.intervalCount);
  else end.setFullYear(end.getFullYear() + plan.intervalCount);
  return end;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Tiered pricing: a plan is sized by how many students it covers, so a school
// that outgrows its tier has to move up before it can admit the next student.
// ---------------------------------------------------------------------------

/**
 * The top tier carries no price a school can just pay — sales quotes it. The
 * flag lives in the plan's feature map so the catalogue, not the code, decides
 * which tier that is.
 */
export function isQuotedPlan(plan: Pick<Plan, "features">) {
  return (plan.features as Record<string, unknown> | null)?.customPricing === true;
}

function coversStudents(plan: Pick<Plan, "maxStudents">, students: number) {
  return plan.maxStudents === null || plan.maxStudents >= students;
}

/**
 * The cheapest tier on sale that both covers `students` and costs more than the
 * school pays today. Ordered by price rather than by sortOrder, so a plan added
 * to the catalogue out of order cannot land a school on a dearer tier than it
 * needs. Null when nothing on the price list is big enough, which only happens
 * if the catalogue has no uncapped tier.
 */
export function chooseUpgradePlan(plans: Plan[], students: number, currentPriceMinor: number) {
  return (
    plans
      .filter((plan) => plan.isActive && plan.isPublic && plan.priceMinor > currentPriceMinor)
      .sort((a, b) => a.priceMinor - b.priceMinor || a.sortOrder - b.sortOrder)
      .find((plan) => coversStudents(plan, students)) ?? null
  );
}

export type UpgradeOption = {
  planCode: string;
  planName: string;
  currency: string;
  maxStudents: number | null;
  listPriceMinor: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxPercent: number;
  /** True when only the gap between the two plans is charged and the renewal date is kept. */
  chargesDifferenceOnly: boolean;
  periodStart: Date;
  periodEnd: Date;
  /** False when this move cannot be bought online; `note` says who to talk to. */
  selfServe: boolean;
  note: string | null;
};

type UpgradeSubscription = {
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  customPriceMinor: number | null;
  plan: Plan;
};

/**
 * What moving to `plan` costs today. Mid-term on a paid plan it is the plain
 * difference between the two list prices and the renewal date does not move —
 * the school already paid for this term, so it only tops up the tier. On a
 * trial or a lapsed term there is nothing to top up, so it is the new plan's
 * full price for a fresh term.
 */
export function priceUpgrade(subscription: UpgradeSubscription, plan: Plan, now = new Date()): UpgradeOption {
  const currentMinor = effectivePriceMinor(subscription.plan, subscription);
  const chargesDifferenceOnly =
    subscription.status === "ACTIVE" && subscription.currentPeriodEnd > now && currentMinor > 0;

  const subtotalMinor = chargesDifferenceOnly ? Math.max(0, plan.priceMinor - currentMinor) : plan.priceMinor;
  const taxPercent = subtotalMinor === 0 ? 0 : env.BILLING_TAX_PERCENT;
  const taxMinor = Math.round((subtotalMinor * taxPercent) / 100);

  // A negotiated rate was agreed with sales, so the difference against it is
  // not ours to charge automatically; the super admin moves those schools over.
  const note = isQuotedPlan(plan)
    ? "Priced on quote — contact SmartShala to move to this plan."
    : subscription.customPriceMinor !== null
      ? "Your school is on an agreed rate, so contact SmartShala to change plan."
      : null;

  return {
    planCode: plan.code,
    planName: plan.name,
    currency: plan.currency,
    maxStudents: plan.maxStudents,
    listPriceMinor: plan.priceMinor,
    subtotalMinor,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
    taxPercent,
    chargesDifferenceOnly,
    periodStart: chargesDifferenceOnly ? subscription.currentPeriodStart : now,
    periodEnd: chargesDifferenceOnly ? subscription.currentPeriodEnd : periodEndFrom(plan, now),
    selfServe: note === null,
    note
  };
}

/** The upgrade a school needs to hold `students`, or null when its tier already fits. */
export async function upgradeForStudents(subscription: UpgradeSubscription, students: number) {
  if (coversStudents(subscription.plan, students)) return null;
  const plans = await masterPrisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { priceMinor: "asc" }] });
  const target = chooseUpgradePlan(plans, students, effectivePriceMinor(subscription.plan, subscription));
  return target ? priceUpgrade(subscription, target) : null;
}
