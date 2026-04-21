import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./students.controller.js";
import { studentSchema } from "./students.schemas.js";

export const studentsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

studentsRouter.use(requireAuth);
studentsRouter.get("/", controller.listStudents);
studentsRouter.get("/:id", controller.getStudent);
studentsRouter.post("/", requireRole(adminRoles), validate({ body: studentSchema }), controller.createStudent);
studentsRouter.patch("/:id", requireRole(adminRoles), validate({ body: studentSchema.partial() }), controller.updateStudent);
studentsRouter.delete("/:id", requireRole(adminRoles), controller.deactivateStudent);
