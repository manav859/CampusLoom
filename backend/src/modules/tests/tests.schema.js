import { z } from 'zod';

export const createTestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  class: z.string().min(1, 'Class is required'),
  subject: z.string().min(1, 'Subject is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD is required'),
  maxMarks: z.number().min(1),
});

export const submitTestResultsSchema = z.object({
  testId: z.string().min(1),
  results: z.array(
    z.object({
      studentId: z.string().min(1),
      marks: z.number().min(0),
    })
  ).min(1),
});

export const getTestsQuerySchema = z.object({
  class: z.string().optional(),
});
