import { z } from "zod";

export const examTermSchema = z.enum(["UNIT_TEST", "CLASS_TEST", "MID_TERM", "FINAL", "TERM_1", "TERM_2"]);

export const marksExamQuerySchema = z.object({
  classId: z.string().uuid().optional()
});

export const marksExamParamsSchema = z.object({
  examId: z.string().uuid()
});

export const createExamWithMarksSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  term: examTermSchema,
  maxMarks: z.coerce.number().positive().max(999),
  passingMarks: z.coerce.number().positive().max(999).optional(),
  description: z.string().trim().max(1000).optional(),
  date: z.coerce.date(),
  results: z.array(
    z.object({
      studentId: z.string().uuid(),
      marks: z.coerce.number().min(0),
      isAbsent: z.boolean().optional(),
      teacherNote: z.string().trim().max(1000).optional()
    })
  ).min(1)
}).superRefine((data, ctx) => {
  const seen = new Set<string>();
  data.results.forEach((result, index) => {
    if (seen.has(result.studentId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate student in marks entry", path: ["results", index, "studentId"] });
    }
    seen.add(result.studentId);
    if (!result.isAbsent && result.marks > data.maxMarks) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Marks cannot exceed max marks", path: ["results", index, "marks"] });
    }
  });
});

export const updateExamResultSchema = z.object({
  studentId: z.string().uuid(),
  marks: z.coerce.number().min(0),
  isAbsent: z.boolean().optional()
});
