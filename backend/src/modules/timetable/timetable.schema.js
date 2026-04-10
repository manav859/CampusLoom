import { z } from 'zod';

export const createTimetableSchema = z.object({
  class: z.string().min(1, 'Class is required'),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  subject: z.string().min(1, 'Subject is required'),
  period: z.number().int().positive(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
  teacherId: z.string().min(1, 'Teacher ID is required'),
});

export const getTimetableQuerySchema = z.object({
  class: z.string().optional(),
  day: z.string().optional(),
  teacherId: z.string().optional(),
});
