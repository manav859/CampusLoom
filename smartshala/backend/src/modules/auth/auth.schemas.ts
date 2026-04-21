import { z } from "zod";
import { UserRole } from "@prisma/client";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole).optional(),
  schoolName: z.string().min(2).optional(),
  schoolCode: z.string().min(2).optional(),
  city: z.string().optional(),
  state: z.string().optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(6)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});
