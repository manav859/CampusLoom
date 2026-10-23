import { z } from "zod";

export const childParamsSchema = z.object({
  id: z.string().uuid()
});

export const childAttendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});
