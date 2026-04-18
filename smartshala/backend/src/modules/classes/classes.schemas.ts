import { z } from "zod";

export const classSchema = z.object({
  name: z.string().min(1),
  section: z.string().min(1),
  academicYear: z.string().min(4),
  classTeacherId: z.string().uuid().nullable().optional()
});

export const assignTeacherSchema = z.object({
  classTeacherId: z.string().uuid().nullable()
});

