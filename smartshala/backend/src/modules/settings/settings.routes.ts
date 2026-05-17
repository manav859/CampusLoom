import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./settings.controller.js";
import { deletionPasswordSchema, schoolProfileSchema } from "./settings.schemas.js";

export const settingsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

settingsRouter.use(requireAuth);
settingsRouter.get("/school-profile", requireRole(adminRoles), controller.getSchoolProfile);
settingsRouter.patch("/school-profile", requireRole(adminRoles), validate({ body: schoolProfileSchema }), controller.updateSchoolProfile);
settingsRouter.get("/database-deletion", requireRole(adminRoles), controller.getDatabaseDeletionStatus);
settingsRouter.post("/database-deletion/verify-password", requireRole(adminRoles), validate({ body: deletionPasswordSchema }), controller.verifyDatabaseDeletionPassword);
settingsRouter.post("/database-deletion/request", requireRole(adminRoles), validate({ body: deletionPasswordSchema }), controller.requestDatabaseDeletion);
settingsRouter.post("/database-deletion/cancel", requireRole(adminRoles), validate({ body: deletionPasswordSchema }), controller.cancelDatabaseDeletion);
