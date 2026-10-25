import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

const leaveStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

/** A parent raising a leave request for their child (used by the parent module). */
export const submitChildLeaveSchema = z
  .object({
    fromDate: isoDate,
    toDate: isoDate,
    reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(500)
  })
  .refine((value) => value.toDate >= value.fromDate, {
    message: "The end date cannot be before the start date",
    path: ["toDate"]
  });

export const studentLeaveListQuerySchema = z.object({
  status: z.enum(leaveStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const studentLeaveDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional()
});
