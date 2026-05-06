import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./marks.controller.js";
import { createExamWithMarksSchema, marksExamParamsSchema, marksExamQuerySchema, updateExamResultSchema } from "./marks.schemas.js";

export const marksRouter = Router();
const marksRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;

marksRouter.use(requireAuth);
marksRouter.get("/context", requireRole(marksRoles), controller.context);
marksRouter.get("/exams", requireRole(marksRoles), validate({ query: marksExamQuerySchema }), controller.listExams);
marksRouter.post("/exams", requireRole(marksRoles), validate({ body: createExamWithMarksSchema }), controller.createExamWithMarks);
marksRouter.get("/exams/:examId", requireRole(marksRoles), validate({ params: marksExamParamsSchema }), controller.getExam);
marksRouter.patch(
  "/exams/:examId/results",
  requireRole(marksRoles),
  validate({ params: marksExamParamsSchema, body: updateExamResultSchema }),
  controller.updateExamResult
);
