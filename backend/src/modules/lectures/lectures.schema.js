import { z } from 'zod';

export const createLectureSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  videoUrl: z.string().url('Invalid video URL'),
  subject: z.string().min(1, 'Subject is required'),
  class: z.string().min(1, 'Class is required'),
});

export const getLecturesQuerySchema = z.object({
  class: z.string().optional(),
  subject: z.string().optional(),
});
