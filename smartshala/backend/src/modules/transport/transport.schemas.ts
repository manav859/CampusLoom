import { z } from "zod";

// 24-hour wall-clock time, the same format as the bell timings.
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:mm time");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const idParamsSchema = z.object({ id: z.string().uuid() });
export const studentParamsSchema = z.object({ studentId: z.string().uuid() });

export const vehicleSchema = z.object({
  registrationNumber: z.string().trim().min(4, "Enter the registration number").max(20),
  capacity: z.coerce.number().int("Capacity is a whole number of seats").min(1, "Capacity must be at least 1").max(200),
  driverName: optionalText(100),
  driverPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Use a 10-digit phone number")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null))
});

export const routeSchema = z.object({
  name: z.string().trim().min(2, "Give the route a name").max(80),
  vehicleId: z.string().uuid().optional().nullable(),
  // In travel order. A stop sent with its id keeps it, so students stay at that stop.
  stops: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2, "Name every stop").max(100),
        pickupTime: clockTime.optional().nullable(),
        dropTime: clockTime.optional().nullable()
      })
    )
    .max(50)
    .default([])
});

export const assignmentSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, "Choose at least one student").max(500),
  routeId: z.string().uuid(),
  stopId: z.string().uuid().optional().nullable()
});
