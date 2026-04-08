import { z } from 'zod';

const pageContentSchema = z.record(z.string(), z.unknown());
const pageSlugSchema = z.string().trim().min(1, 'Slug is required').max(160, 'Slug is too long');
const pageTitleSchema = z.string().trim().min(1, 'Title is required').max(200, 'Title is too long');

export const pageStatusSchema = z.enum(['draft', 'published']);

export const createPageSchema = z.object({
  title: pageTitleSchema,
  slug: pageSlugSchema.optional(),
  content: pageContentSchema,
  status: pageStatusSchema.default('draft'),
  seoTitle: z.string().trim().max(200, 'SEO title is too long').optional().default(''),
  seoDescription: z.string().trim().max(320, 'SEO description is too long').optional().default(''),
});

export const updatePageSchema = createPageSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const updatePageStatusSchema = z.object({
  status: pageStatusSchema,
});

export const pageIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid page id'),
});

export const publicPageSlugParamSchema = z.object({
  slug: z.string().trim().min(1, 'Slug is required').max(160, 'Slug is too long'),
});
