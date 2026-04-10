import { z } from 'zod';

export const markAttendanceSchema = z.object({
  class: z.string().min(1, 'Class is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  records: z.array(
    z.object({
      studentId: z.string().min(1, 'Student ID is required'),
      status: z.enum(['present', 'absent']),
    })
  ).min(1, 'At least one attendance record is required'),
});

export const getAttendanceByStudentQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional(),
});

export const getAttendanceByClassQuerySchema = z.object({
  class: z.string().min(1, 'Class is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
});
