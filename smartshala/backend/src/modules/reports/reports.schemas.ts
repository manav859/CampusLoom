import { z } from "zod";

export const examReportQuerySchema = z.object({
  classIds: z.string().optional(),
  examIds: z.string().optional(),
  subjectIds: z.string().optional()
});
