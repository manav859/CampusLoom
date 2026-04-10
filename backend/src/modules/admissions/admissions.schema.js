import { z } from 'zod';

export const admissionStatusSchema = z.enum(['new', 'in_review', 'approved', 'rejected']);

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid admission id');

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(120, 'Name is too long');

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone is required')
  .max(32, 'Phone is too long')
  .refine((value) => {
    const digits = value.replace(/\D/g, '');

    return digits.length >= 7 && digits.length <= 15;
  }, 'Phone number is invalid');

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Email must be valid')
  .max(160, 'Email is too long');

const classSchema = z
  .string()
  .trim()
  .min(1, 'Class is required')
  .max(80, 'Class is too long');

const messageSchema = z
  .string()
  .trim()
  .max(1500, 'Message is too long')
  .optional()
  .transform((value) => value || undefined);

export const createAdmissionSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  class: classSchema,
  message: messageSchema,
});

export const admissionIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listAdmissionsQuerySchema = z.object({
  status: admissionStatusSchema.optional(),
});

export const updateAdmissionStatusSchema = z.object({
  status: admissionStatusSchema,
});

export const createAdmissionNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, 'Note is required')
    .max(1000, 'Note is too long'),
});
