import { z } from "zod";
import { UserRole } from "@prisma/client";

export const superAdminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72)
});

export const schoolIdParamSchema = z.object({
  schoolId: z.string().trim().regex(/^[A-Z0-9]{8}$/)
});

export const userActionParamSchema = schoolIdParamSchema.extend({
  userId: z.string().uuid()
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8).max(72)
});

export const passwordResetRequestParamSchema = z.object({
  requestId: z.string().uuid()
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole)
});

export const updateSchoolStatusSchema = z.object({
  isActive: z.boolean()
});

export const extendSchoolAccessSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30)
});
