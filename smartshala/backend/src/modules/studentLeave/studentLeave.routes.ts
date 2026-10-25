import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./studentLeave.controller.js";
import { studentLeaveDecisionSchema, studentLeaveListQuerySchema } from "./studentLeave.schemas.js";

/**
 * Staff review of parent-raised child-leave requests. Parents submit and track
 * their own through `/parent/children/:id/leave`; this router is the office
 * side — any staff member can read the queue, Principal/Admin decide it.
 */
export const studentLeaveRouter = Router();

const staffRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;
const approverRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

studentLeaveRouter.use(requireAuth, requireRole(staffRoles));

studentLeaveRouter.get(
  "/requests",
  validate({ query: studentLeaveListQuerySchema }),
  controller.listStudentLeave
);

studentLeaveRouter.patch(
  "/requests/:id/decision",
  requireRole(approverRoles),
  validate({ body: studentLeaveDecisionSchema }),
  controller.decideStudentLeave
);
