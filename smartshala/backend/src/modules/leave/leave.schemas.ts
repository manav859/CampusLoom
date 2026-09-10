import { z } from "zod";

export const leaveTypes = ["CASUAL", "SICK", "EARNED", "MATERNITY", "UNPAID", "OTHER"] as const;
export const leaveStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const applyLeaveSchema = z
  .object({
    type: z.enum(leaveTypes),
    fromDate: isoDate,
    toDate: isoDate,
    reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(500)
  })
  .refine((value) => value.toDate >= value.fromDate, {
    message: "The end date cannot be before the start date",
    path: ["toDate"]
  });

export const leaveListQuerySchema = z.object({
  status: z.enum(leaveStatuses).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const leaveDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional()
});
