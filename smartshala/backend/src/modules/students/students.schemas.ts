import { BehaviourSeverity, BehaviourType, Gender, StudentDocumentType } from "@prisma/client";
import { z } from "zod";

export const studentSchema = z.object({
  classId: z.string().uuid(),
  fullName: z.string().min(2),
  admissionNumber: z.string().min(1).optional(),
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

export const behaviourRecordSchema = z.object({
  type: z.nativeEnum(BehaviourType),
  title: z.string().min(2).max(160),
  summary: z.string().min(2).max(2000),
  severity: z.nativeEnum(BehaviourSeverity).optional(),
  occurredAt: z.coerce.date().optional(),
  isRestricted: z.boolean().optional(),
  actionTaken: z.string().max(1000).optional()
});

export const studentDocumentSchema = z.object({
  type: z.nativeEnum(StudentDocumentType),
  name: z.string().min(2).max(160).optional()
});
