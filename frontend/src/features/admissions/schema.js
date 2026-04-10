import { z } from 'zod';

export const admissionInquiryFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone is required')
    .max(32, 'Phone is too long')
    .refine((value) => {
      const digits = value.replace(/\D/g, '');

      return digits.length >= 7 && digits.length <= 15;
    }, 'Phone number is invalid'),
  email: z.string().trim().min(1, 'Email is required').email('Email must be valid').max(160, 'Email is too long'),
  classLevel: z.string().trim().min(1, 'Class is required').max(80, 'Class is too long'),
  message: z.string().trim().max(1500, 'Message is too long').optional(),
});

export const admissionNoteFormSchema = z.object({
  note: z.string().trim().min(1, 'Note is required').max(1000, 'Note is too long'),
});
