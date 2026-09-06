import { Prisma } from "../../node_modules/@smartshala/master-client/index.js";
import { masterPrisma } from "../master-db/masterPrisma.js";
import { discountMinorFor, loadCoupon, rupeesFromMinor } from "../modules/billing/billing.pricing.js";

/** Used only if the plan catalogue has not been seeded yet. */
const FALLBACK_BASE_PRICE = 20_000;

export type CouponPreview = {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode: string | null;
  valid: boolean;
  message: string;
};

/**
 * The onboarding form quotes the default paid plan. The price now lives in the
 * plan catalogue the super admin edits, not in a constant.
 */
export async function defaultPaidPlan() {
  return (
    (await masterPrisma.plan.findUnique({ where: { code: "STANDARD" } })) ??
    (await masterPrisma.plan.findFirst({
      where: { isActive: true, isPublic: true, priceMinor: { gt: 0 } },
      orderBy: [{ sortOrder: "asc" }, { priceMinor: "asc" }]
    }))
  );
}

export async function previewCoupon(code?: string | null): Promise<CouponPreview> {
  const plan = await defaultPaidPlan().catch(() => null);
  const baseMinor = plan?.priceMinor ?? FALLBACK_BASE_PRICE * 100;
  const { coupon, valid, message } = await loadCoupon(code);
  const discountMinor = discountMinorFor(coupon, baseMinor);

  return {
    baseAmount: rupeesFromMinor(baseMinor),
    discountAmount: rupeesFromMinor(discountMinor),
    finalAmount: rupeesFromMinor(baseMinor - discountMinor),
    couponCode: coupon?.code ?? (code?.trim().toUpperCase() || null),
    valid,
    message
  };
}

export function decimalAmount(value: number) {
  return new Prisma.Decimal(value);
}
