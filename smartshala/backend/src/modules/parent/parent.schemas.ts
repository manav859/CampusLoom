import { z } from "zod";

export const childParamsSchema = z.object({
  id: z.string().uuid()
});

export const childAttendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

export const childReceiptParamsSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid()
});

export const feePayLinkSchema = z.object({
  assignmentId: z.string().uuid()
});

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month").optional()
});

export const announcementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const childDocumentParamsSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid()
});

export const feePayTokenParamsSchema = z.object({
  token: z.string().min(16)
});

export const feePayConfirmSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1)
});

export const feePayMockSchema = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(["success", "failure"]),
  method: z.string().min(1).default("upi")
});
