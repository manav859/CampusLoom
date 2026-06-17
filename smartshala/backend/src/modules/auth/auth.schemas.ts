import { z } from "zod";
import { UserRole } from "@prisma/client";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8).max(72),
  role: z.nativeEnum(UserRole).optional(),
  schoolName: z.string().min(2).optional(),
  schoolCode: z.string().min(2).optional(),
  city: z.string().optional(),
  state: z.string().optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(6).max(72)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3)
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10).optional(),
  academicBackground: z.string().optional().or(z.literal(""))
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(72),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(72)
});
