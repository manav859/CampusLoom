import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(6)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

