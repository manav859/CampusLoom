import { Prisma } from "../../node_modules/@smartshala/master-client/index.js";
import { masterPrisma } from "../master-db/masterPrisma.js";

const BASE_PRICE = 20_000;

export type CouponPreview = {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode: string | null;
  valid: boolean;
  message: string;
};

export async function previewCoupon(code?: string | null): Promise<CouponPreview> {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) {
    return {
      baseAmount: BASE_PRICE,
      discountAmount: 0,
      finalAmount: BASE_PRICE,
      couponCode: null,
      valid: true,
      message: "No coupon applied"
    };
  }

  const coupon = await masterPrisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.isActive) {
    return {
      baseAmount: BASE_PRICE,
      discountAmount: 0,
      finalAmount: BASE_PRICE,
      couponCode: normalized,
      valid: false,
      message: "Coupon is invalid"
    };
  }

  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    return {
      baseAmount: BASE_PRICE,
      discountAmount: 0,
      finalAmount: BASE_PRICE,
      couponCode: normalized,
      valid: false,
      message: "Coupon has expired"
    };
  }

  const discountValue = Number(coupon.discountValue);
  const discountAmount =
    coupon.discountType === "PERCENTAGE"
      ? Math.min(BASE_PRICE, Math.round((BASE_PRICE * discountValue) / 100))
      : Math.min(BASE_PRICE, discountValue);

  return {
    baseAmount: BASE_PRICE,
    discountAmount,
    finalAmount: Math.max(0, BASE_PRICE - discountAmount),
    couponCode: normalized,
    valid: true,
    message: `Coupon ${normalized} applied`
  };
}

export function decimalAmount(value: number) {
  return new Prisma.Decimal(value);
}
