import { HomeworkSubmissionStatus } from "@prisma/client";
import { z } from "zod";

export const homeworkAssignmentQuerySchema = z.object({
  classId: z.string().uuid().optional()
});

export const createHomeworkAssignmentSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  assignedDate: z.coerce.date().optional(),
  dueDate: z.coerce.date()
}).refine((data) => !data.assignedDate || data.dueDate >= data.assignedDate, {
  message: "Due date must be on or after assigned date",
  path: ["dueDate"]
});

export const homeworkAssignmentParamsSchema = z.object({
  assignmentId: z.string().uuid()
});

export const updateHomeworkSubmissionSchema = z.object({
  studentId: z.string().uuid(),
  status: z.nativeEnum(HomeworkSubmissionStatus),
  marks: z.coerce.number().min(0).max(20).optional().nullable(),
  teacherNote: z.string().trim().max(1000).optional().nullable(),
  submittedAt: z.coerce.date().optional().nullable()
});
