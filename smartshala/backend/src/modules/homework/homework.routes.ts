import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./homework.controller.js";
import {
  createHomeworkAssignmentSchema,
  homeworkAssignmentParamsSchema,
  homeworkAssignmentQuerySchema,
  updateHomeworkSubmissionSchema
} from "./homework.schemas.js";

export const homeworkRouter = Router();
const homeworkRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;

homeworkRouter.use(requireAuth);
homeworkRouter.get("/context", requireRole(homeworkRoles), controller.context);
homeworkRouter.get("/assignments", requireRole(homeworkRoles), validate({ query: homeworkAssignmentQuerySchema }), controller.listAssignments);
homeworkRouter.post("/assignments", requireRole(homeworkRoles), validate({ body: createHomeworkAssignmentSchema }), controller.createAssignment);
homeworkRouter.get(
  "/assignments/:assignmentId",
  requireRole(homeworkRoles),
  validate({ params: homeworkAssignmentParamsSchema }),
  controller.getAssignment
);
homeworkRouter.patch(
  "/assignments/:assignmentId/submissions",
  requireRole(homeworkRoles),
  validate({ params: homeworkAssignmentParamsSchema, body: updateHomeworkSubmissionSchema }),
  controller.updateSubmission
);
