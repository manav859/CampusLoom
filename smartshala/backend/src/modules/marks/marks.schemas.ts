import { z } from "zod";

export const marksExamQuerySchema = z.object({
  classId: z.string().uuid().optional()
});

export const createExamWithMarksSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  maxMarks: z.coerce.number().positive().max(999),
  date: z.coerce.date(),
  results: z.array(
    z.object({
      studentId: z.string().uuid(),
      marks: z.coerce.number().min(0),
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
    if (result.marks > data.maxMarks) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Marks cannot exceed max marks", path: ["results", index, "marks"] });
    }
  });
});
