import { z } from 'zod';

const titleSchema = z.string().trim().min(1, 'Title is required').max(200, 'Title is too long');
const contentSchema = z.string().trim().min(1, 'Content is required').max(5000, 'Content is too long');
const publishDateSchema = z.coerce.date({
  error: 'Publish date is required',
});
const expiryDateSchema = z.coerce
  .date({
    error: 'Expiry date must be a valid date',
  })
  .nullable()
  .optional();

export const noticeTypeSchema = z.enum(['general', 'exam', 'holiday', 'urgent']);

function refineNoticeDates(payload) {
  if (!payload.expiryDate) {
    return true;
  }

  return payload.expiryDate > payload.publishDate;
}

const noticePayloadSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  type: noticeTypeSchema.default('general'),
  publishDate: publishDateSchema,
  expiryDate: expiryDateSchema,
  isActive: z.boolean().optional().default(true),
});

export const createNoticeSchema = noticePayloadSchema
  .refine(refineNoticeDates, {
    message: 'Expiry date must be after publish date',
    path: ['expiryDate'],
  });

export const updateNoticeSchema = noticePayloadSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(
    (value) => {
      if (!value.publishDate || !value.expiryDate) {
        return true;
      }

      return value.expiryDate > value.publishDate;
    },
    {
      message: 'Expiry date must be after publish date',
      path: ['expiryDate'],
    },
  );

export const updateNoticeStatusSchema = z.object({
  isActive: z.boolean(),
});

export const noticeIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid notice id'),
});
