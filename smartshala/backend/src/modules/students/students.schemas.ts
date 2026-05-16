import { BehaviourSeverity, BehaviourType, Gender, StudentDocumentType } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().min(2).nullable().optional();
const optionalPhone = z.string().min(10).nullable().optional();
const optionalDate = z.union([z.null(), z.coerce.date()]).optional();

export const studentSchema = z.object({
  classId: z.string().uuid(),
  fullName: z.string().min(2),
  admissionNumber: z.string().min(1).optional(),
  rollNumber: z.coerce.number().int().positive().nullable().optional(),
  dateOfBirth: optionalDate,
  gender: z.nativeEnum(Gender).nullable().optional(),
  parentName: z.string().min(2),
  parentPhone: z.string().min(10),
  alternatePhone: optionalPhone,
  fatherName: optionalText,
  fatherPhone: optionalPhone,
  fatherOccupation: optionalText,
  motherName: optionalText,
  motherPhone: optionalPhone,
  motherOccupation: optionalText,
  guardianName: optionalText,
  guardianPhone: optionalPhone,
  guardianOccupation: optionalText,
  address: z.string().nullable().optional(),
  joiningDate: optionalDate,
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
