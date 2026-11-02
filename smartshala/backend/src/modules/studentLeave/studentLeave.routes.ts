import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./studentLeave.controller.js";
import { studentLeaveDecisionSchema, studentLeaveListQuerySchema } from "./studentLeave.schemas.js";

/**
 * Staff review of parent-raised child-leave requests. Parents submit and track
 * their own through `/parent/children/:id/leave`; this router is the school
 * side. A class teacher sees and decides only their own class's requests —
 * the service scopes every query — while Principal/Admin work the whole
 * school.
 */
export const studentLeaveRouter = Router();

const staffRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;

studentLeaveRouter.use(requireAuth, requireRole(staffRoles));

studentLeaveRouter.get(
  "/requests",
  validate({ query: studentLeaveListQuerySchema }),
  controller.listStudentLeave
);

studentLeaveRouter.patch(
  "/requests/:id/decision",
  validate({ body: studentLeaveDecisionSchema }),
  controller.decideStudentLeave
);
