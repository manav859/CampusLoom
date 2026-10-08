import { z } from "zod";

export const calendarEventTypes = ["EXAM", "EVENT", "MEETING"] as const;

// The round-trip check rejects dates like 2026-02-31, which Date would
// otherwise roll forward into March.
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "That date does not exist");

// Wall-clock 24-hour time, as the school bell's period times are stored.
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a HH:mm time");

export const calendarMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a YYYY-MM month")
});

export const calendarEventSchema = z.object({
  type: z.enum(calendarEventTypes),
  title: z.string().trim().min(3, "Give the event a title").max(150),
  description: z.string().trim().max(1000).optional(),
  startDate: day,
  // Omitted for the common single-day event.
  endDate: day.optional(),
  // Both omitted for an all-day event.
  startTime: time.optional().nullable(),
  endTime: time.optional().nullable()
});

export const calendarEventParamsSchema = z.object({
  id: z.string().uuid()
});
