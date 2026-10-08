import { z } from "zod";

/** The public enquiry form. It creates a lead for the sales team, not a school. */
export const onboardingSchema = z.object({
  schoolName: z.string().trim().min(2).max(160),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(10).max(20),
  address: z.string().trim().min(5).max(500),
  numberOfStudents: z.coerce.number().int().min(1).max(10000),
  numberOfStaff: z.coerce.number().int().min(1).max(1000),
  termsAccepted: z.literal(true)
});

export const couponPreviewSchema = z.object({
  code: z.string().trim().max(40).optional()
});
