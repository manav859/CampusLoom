import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

export const createTeacherSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email().trim().optional().or(z.literal("")),
  phone: z.string().trim().min(10),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole).default(UserRole.TEACHER)
}).transform((data) => ({
  ...data,
  email: data.email === "" ? undefined : data.email
}));

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(10).optional(),
  status: z.nativeEnum(UserStatus).optional()
});

