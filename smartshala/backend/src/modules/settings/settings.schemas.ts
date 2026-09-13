import { z } from "zod";

const optionalText = z.string().trim().max(200).optional().nullable().transform((value) => value || null);

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: optionalText,
  state: optionalText,
  phone: optionalText,
  udiseNumber: optionalText,
  affiliationBoard: optionalText,
  logoUrl: z.string().trim().max(250_000).optional().nullable().transform((value) => value || null),
  timetablePeriodCount: z.coerce.number().int().min(1).max(12).optional().default(8)
});

// 24-hour wall-clock time, e.g. "08:45" — what an HTML time input sends.
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:mm time");

export const periodTimesSchema = z.object({
  periods: z
    .array(
      z.object({
        periodNumber: z.coerce.number().int().min(1).max(12),
        startTime: clockTime,
        endTime: clockTime
      })
    )
    .max(12)
});

export const deletionPasswordSchema = z.object({
  password: z.string().min(8).max(72)
});
