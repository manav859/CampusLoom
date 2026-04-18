import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./users.controller.js";
import { createTeacherSchema, updateUserSchema } from "./users.schemas.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.get("/teachers", requireRole(UserRole.ADMIN), controller.listTeachers);
usersRouter.post("/teachers", requireRole(UserRole.ADMIN), validate({ body: createTeacherSchema }), controller.createTeacher);
usersRouter.patch("/:id", requireRole(UserRole.ADMIN), validate({ body: updateUserSchema }), controller.updateUser);

