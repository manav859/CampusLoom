import { z } from "zod";

const optionalText = z.string().trim().max(200).optional().nullable().transform((value) => value || null);

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: optionalText,
  state: optionalText,
  phone: optionalText,
  gstin: optionalText,
  udiseNumber: optionalText,
  affiliationBoard: optionalText,
  logoUrl: z.string().trim().max(250_000).optional().nullable().transform((value) => value || null)
});
