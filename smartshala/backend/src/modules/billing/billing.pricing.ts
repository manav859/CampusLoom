import { DiscountType } from "../../../node_modules/@smartshala/master-client/index.js";
import type { Coupon, Plan } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";

export type Quote = {
  planCode: string;
  planName: string;
  currency: string;
  subtotalMinor: number;
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
export async function quotePlan(plan: Plan, couponCode?: string | null): Promise<Quote> {
  const { coupon, valid, message } = await loadCoupon(couponCode);
  const subtotalMinor = plan.priceMinor;
  const discountMinor = discountMinorFor(coupon, subtotalMinor);
  const taxable = subtotalMinor - discountMinor;
  const taxPercent = plan.priceMinor === 0 ? 0 : env.BILLING_TAX_PERCENT;
  const taxMinor = Math.round((taxable * taxPercent) / 100);

  return {
    planCode: plan.code,
    planName: plan.name,
    currency: plan.currency,
    subtotalMinor,
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
