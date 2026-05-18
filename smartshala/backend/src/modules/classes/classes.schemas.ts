import { z } from "zod";

export const classSchema = z.object({
  name: z.string().min(1),
  section: z.string().min(1),
  academicYear: z.string().min(4),
  classTeacherId: z.string().uuid(),
  maximumStrength: z.coerce.number().int().positive().nullable().optional(),
  stream: z.string().trim().min(2).nullable().optional(),
  mediumOfInstruction: z.string().trim().min(2),
  subjects: z.array(z.string().trim().min(2)).min(1).max(20)
});

export const assignTeacherSchema = z.object({
  classTeacherId: z.string().uuid().nullable()
});
