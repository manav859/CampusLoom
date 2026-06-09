import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./users.controller.js";
import { createAccountantSchema, createTeacherSchema, resetTeacherPasswordSchema, teacherAssignmentParamsSchema, teacherPeriodAssignmentsSchema, updateUserSchema } from "./users.schemas.js";

export const usersRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

usersRouter.use(requireAuth);
usersRouter.get("/teachers", requireRole(adminRoles), controller.listTeachers);
usersRouter.post("/teachers", requireRole(adminRoles), validate({ body: createTeacherSchema }), controller.createTeacher);
usersRouter.post("/accountants", requireRole(adminRoles), validate({ body: createAccountantSchema }), controller.createAccountant);
usersRouter.get("/teachers/:id", requireRole(adminRoles), validate({ params: teacherAssignmentParamsSchema }), controller.getTeacher);
usersRouter.get("/teachers/:id/assignments", requireRole(adminRoles), validate({ params: teacherAssignmentParamsSchema }), controller.getTeacherAssignments);
usersRouter.put(
  "/teachers/:id/assignments",
  requireRole(adminRoles),
  validate({ params: teacherAssignmentParamsSchema, body: teacherPeriodAssignmentsSchema }),
  controller.updateTeacherAssignments
);
usersRouter.patch(
  "/teachers/:id/password",
  requireRole(adminRoles),
  validate({ params: teacherAssignmentParamsSchema, body: resetTeacherPasswordSchema }),
  controller.resetTeacherPassword
);
usersRouter.patch("/:id/activate", requireRole(adminRoles), controller.activateUser);
usersRouter.patch("/:id", requireRole(adminRoles), validate({ body: updateUserSchema }), controller.updateUser);
usersRouter.delete("/:id", requireRole(adminRoles), controller.deleteUser);
