import { z } from "zod";

export const askSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })
    )
    .max(10)
    .default([])
});

export type AskInput = z.infer<typeof askSchema>;
