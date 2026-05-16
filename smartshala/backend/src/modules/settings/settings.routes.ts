import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./settings.controller.js";
import { schoolProfileSchema } from "./settings.schemas.js";

export const settingsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

settingsRouter.use(requireAuth);
settingsRouter.get("/school-profile", requireRole(adminRoles), controller.getSchoolProfile);
settingsRouter.patch("/school-profile", requireRole(adminRoles), validate({ body: schoolProfileSchema }), controller.updateSchoolProfile);
