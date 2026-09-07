import { z } from "zod";

const planCode = z.string().trim().min(2).max(40).transform((value) => value.toUpperCase());
const couponCode = z.string().trim().max(40).optional().nullable();

// --- Principal ---------------------------------------------------------------

export const quoteQuerySchema = z.object({
  planCode,
  couponCode: z.string().trim().max(40).optional()
});

export const checkoutSchema = z.object({
  planCode,
  couponCode
});

export const confirmCheckoutSchema = z.object({
  razorpay_order_id: z.string().trim().min(4).max(80),
  razorpay_payment_id: z.string().trim().min(4).max(80),
  razorpay_signature: z.string().trim().min(16).max(200)
});

export const invoiceParamSchema = z.object({
  invoiceId: z.string().uuid()
});

export const autoRenewSchema = z.object({
  autoRenew: z.boolean()
});

export const mockPaySchema = z.object({
  orderId: z.string().trim().min(4).max(80),
  outcome: z.enum(["success", "failure"]).default("success"),
  method: z.enum(["card", "upi", "netbanking", "wallet"]).default("upi")
});

// --- Super admin -------------------------------------------------------------

export const planIdParamSchema = z.object({ planId: z.string().uuid() });
export const couponIdParamSchema = z.object({ couponId: z.string().uuid() });
export const paymentIdParamSchema = z.object({ paymentId: z.string().uuid() });

const featureMap = z.record(z.boolean());

export const createPlanSchema = z.object({
  code: planCode,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  priceRupees: z.coerce.number().min(0).max(100_000_000),
  currency: z.string().trim().length(3).default("INR"),
  interval: z.enum(["MONTH", "YEAR"]),
  intervalCount: z.coerce.number().int().min(1).max(36).default(1),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  maxStudents: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  maxStaff: z.coerce.number().int().min(1).max(100_000).nullable().optional(),
  features: featureMap.optional(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
});

export const updatePlanSchema = createPlanSchema.partial().omit({ code: true });

export const createCouponSchema = z.object({
  code: z.string().trim().min(3).max(40),
  description: z.string().trim().max(300).optional().nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.coerce.number().min(0).max(1_000_000),
  maxRedemptions: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().nullable().optional()
});

export const updateCouponSchema = createCouponSchema.partial().omit({ code: true });

export const subscriptionListQuerySchema = z.object({
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]).optional(),
  planCode: z.string().trim().max(40).optional(),
  query: z.string().trim().max(120).optional()
});

export const changePlanSchema = z.object({
  planCode,
  restartPeriod: z.boolean().default(true),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]).optional(),
  reason: z.string().trim().max(300).optional(),
  // Omit to bill at the plan list price; send a number to carry a negotiated
  // rate onto the new plan.
  customPriceRupees: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  force: z.boolean().default(false)
});

export const customPriceSchema = z.object({
  // null clears the override and returns the school to the plan list price.
  priceRupees: z.coerce.number().min(0).max(100_000_000).nullable(),
  note: z.string().trim().max(300).optional().nullable()
});

export const extendSubscriptionSchema = z.object({
  days: z.coerce.number().int().min(1).max(730),
  reason: z.string().trim().max(300).optional()
});

export const subscriptionStatusSchema = z.object({
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]),
  reason: z.string().trim().max(300).optional()
});

export const manualInvoiceSchema = z.object({
  planCode,
  couponCode,
  notes: z.string().trim().max(500).optional().nullable()
});

export const markPaidSchema = z.object({
  method: z.enum(["cash", "cheque", "neft", "upi", "card", "other"]),
  reference: z.string().trim().max(120).optional().nullable()
});

export const voidInvoiceSchema = z.object({
  reason: z.string().trim().min(3).max(300)
});

export const refundSchema = z.object({
  amountRupees: z.coerce.number().min(1).max(100_000_000).optional(),
  reason: z.string().trim().min(3).max(300)
});

export const invoiceListQuerySchema = z.object({
  status: z.enum(["DRAFT", "DUE", "PAID", "VOID", "REFUNDED"]).optional(),
  schoolId: z.string().trim().regex(/^[A-Z0-9]{8}$/).optional(),
  take: z.coerce.number().int().min(1).max(500).optional()
});
