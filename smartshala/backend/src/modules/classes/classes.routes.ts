import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./classes.controller.js";
import { classSchema } from "./classes.schemas.js";

export const classesRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

classesRouter.use(requireAuth);
classesRouter.get("/", controller.listClasses);
classesRouter.get("/:id/students", controller.getClassStudents);
classesRouter.post("/", requireRole(adminRoles), validate({ body: classSchema }), controller.createClass);
classesRouter.patch("/:id", requireRole(adminRoles), validate({ body: classSchema.partial() }), controller.updateClass);
