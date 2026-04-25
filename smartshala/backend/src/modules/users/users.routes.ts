import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./users.controller.js";
import { createTeacherSchema, updateUserSchema } from "./users.schemas.js";

export const usersRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

usersRouter.use(requireAuth);
usersRouter.get("/teachers", requireRole(adminRoles), controller.listTeachers);
usersRouter.post("/teachers", requireRole(adminRoles), validate({ body: createTeacherSchema }), controller.createTeacher);
usersRouter.patch("/:id", requireRole(adminRoles), validate({ body: updateUserSchema }), controller.updateUser);
usersRouter.delete("/:id", requireRole(adminRoles), controller.deleteUser);
