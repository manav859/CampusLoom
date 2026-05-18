import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

export const createTeacherSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email().trim().optional().or(z.literal("")),
  phone: z.string().trim().min(10),
  password: z.string().min(6),
  role: z.literal(UserRole.TEACHER).optional().default(UserRole.TEACHER)
}).transform((data) => ({
  ...data,
  email: data.email === "" ? undefined : data.email
}));

export const createAccountantSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email().trim(),
  password: z.string().min(6),
  role: z.literal(UserRole.ACCOUNTANT).optional().default(UserRole.ACCOUNTANT)
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(10).optional(),
  status: z.nativeEnum(UserStatus).optional()
});

export const teacherAssignmentParamsSchema = z.object({
  id: z.string().uuid()
});

export const teacherPeriodAssignmentsSchema = z.object({
  periods: z.array(
    z.object({
      periodNumber: z.coerce.number().int().min(1).max(8),
      classId: z.string().uuid().nullable().optional(),
      subjectId: z.string().uuid().nullable().optional()
    })
  ).length(8)
}).refine((data) => new Set(data.periods.map((period) => period.periodNumber)).size === 8, {
  message: "Each period number from 1 to 8 must be unique",
  path: ["periods"]
});
