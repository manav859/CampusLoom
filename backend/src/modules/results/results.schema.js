import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const examTypeSchema = z.enum(['midterm', 'final', 'unit_test', 'practical']);

export const createResultSchema = z
  .object({
    studentId: objectIdSchema,
    subject: z
      .string()
      .trim()
      .min(1, 'Subject is required')
      .max(120, 'Subject is too long'),
    marks: z
      .number({ required_error: 'Marks are required', invalid_type_error: 'Marks must be a number' })
      .min(0, 'Marks cannot be negative'),
    maxMarks: z
      .number({ required_error: 'Max marks are required', invalid_type_error: 'Max marks must be a number' })
      .min(1, 'Max marks must be at least 1'),
    examType: examTypeSchema,
  })
  .refine((data) => data.marks <= data.maxMarks, {
    message: 'Marks cannot exceed max marks',
    path: ['marks'],
  });

export const studentIdParamSchema = z.object({
  studentId: objectIdSchema,
});
