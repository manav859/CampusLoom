import { z } from 'zod';

export const noticeTypeOptions = [
  { label: 'General', value: 'general' },
  { label: 'Exam', value: 'exam' },
  { label: 'Holiday', value: 'holiday' },
  { label: 'Urgent', value: 'urgent' },
];

const dateFieldSchema = z.string().trim().min(1, 'Publish date is required').refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  {
    message: 'Publish date is invalid',
  },
);

export const noticeFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
    content: z.string().trim().min(1, 'Content is required').max(5000, 'Content is too long'),
    type: z.enum(['general', 'exam', 'holiday', 'urgent']),
    publishDate: dateFieldSchema,
    expiryDate: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || '')
      .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
        message: 'Expiry date is invalid',
      }),
    isActive: z.boolean(),
  })
  .refine(
    (value) => {
      if (!value.expiryDate) {
        return true;
      }

      return new Date(value.expiryDate) > new Date(value.publishDate);
    },
    {
      message: 'Expiry date must be after publish date',
      path: ['expiryDate'],
    },
  );
