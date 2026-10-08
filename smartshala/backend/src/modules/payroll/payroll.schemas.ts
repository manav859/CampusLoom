import { z } from "zod";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month");

// Rupees with at most two decimals; the column is Decimal(12, 2).
const amount = z.coerce
  .number()
  .min(0, "Amounts cannot be negative")
  .max(9_999_999_999)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most two decimals");

export const payrollMonthQuerySchema = z.object({ month });

export const salarySlipSchema = z.object({
  userId: z.string().uuid(),
  month,
  basicPay: amount,
  allowances: amount.default(0),
  deductions: amount.default(0),
  status: z.enum(["PENDING", "PAID"]),
  // Defaults to today when a slip is marked paid without a date.
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date").optional().nullable(),
  note: z.string().trim().max(300).optional().nullable()
});

export const salarySlipParamsSchema = z.object({ id: z.string().uuid() });

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a HH:mm time");

export const shiftSchema = z.object({
  name: z.string().trim().min(1, "Name the shift").max(60),
  startTime: time,
  endTime: time
});

export const payProfileSchema = z.object({
  monthlySalary: amount,
  shiftId: z.string().uuid().nullable().optional()
});

export const payProfileParamsSchema = z.object({ userId: z.string().uuid() });

export const generateSlipsSchema = z.object({ month });
