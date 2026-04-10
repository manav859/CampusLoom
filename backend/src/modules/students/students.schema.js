import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid student id');

export const studentIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listStudentsQuerySchema = z.object({
  class: z
    .string()
    .trim()
    .max(80, 'Class filter is too long')
    .optional(),
});
