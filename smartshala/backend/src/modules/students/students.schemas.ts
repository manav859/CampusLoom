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
  fatherName: z.string().min(2).optional(),
  fatherPhone: z.string().min(10).optional(),
  fatherOccupation: z.string().min(2).optional(),
  motherName: z.string().min(2).optional(),
  motherPhone: z.string().min(10).optional(),
  motherOccupation: z.string().min(2).optional(),
  guardianName: z.string().min(2).optional(),
  guardianPhone: z.string().min(10).optional(),
  guardianOccupation: z.string().min(2).optional(),
  address: z.string().optional(),
  joiningDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  feeStructureId: z.string().uuid().optional()
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

export const behaviourActionSchema = z.object({
  actionTaken: z.string().trim().min(2).max(1000)
});

export const studentDocumentSchema = z.object({
  type: z.nativeEnum(StudentDocumentType),
  name: z.string().min(2).max(160).optional()
});
