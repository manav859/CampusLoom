import { Gender } from "@prisma/client";
import { z } from "zod";

export const studentSchema = z.object({
  classId: z.string().uuid(),
  fullName: z.string().min(2),
  admissionNumber: z.string().min(1),
  rollNumber: z.coerce.number().int().positive().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.nativeEnum(Gender).optional(),
  parentName: z.string().min(2),
  parentPhone: z.string().min(10),
  alternatePhone: z.string().min(10).optional(),
  address: z.string().optional(),
  joiningDate: z.coerce.date().optional(),
  isActive: z.boolean().optional()
});

