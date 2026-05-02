import { z } from "zod";

export const homeworkAssignmentQuerySchema = z.object({
  classId: z.string().uuid().optional()
});

export const createHomeworkAssignmentSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
  subject: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  assignedDate: z.coerce.date().optional(),
  dueDate: z.coerce.date()
}).refine((data) => !data.assignedDate || data.dueDate >= data.assignedDate, {
  message: "Due date must be on or after assigned date",
  path: ["dueDate"]
});
