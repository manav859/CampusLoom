import { CommunicationMessageType } from "@prisma/client";
import { z } from "zod";

export const communicationListQuerySchema = z.object({
  classId: z.string().uuid().optional()
});

export const sendTeacherMessageSchema = z.object({
  targetType: z.enum(["STUDENT", "CLASS"]),
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  type: z.nativeEnum(CommunicationMessageType),
  message: z.string().trim().min(3).max(1600)
}).superRefine((data, ctx) => {
  if (data.targetType === "STUDENT" && !data.studentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Student is required for individual messages", path: ["studentId"] });
  }
  if (data.targetType === "CLASS" && !data.classId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Class is required for class messages", path: ["classId"] });
  }
});
