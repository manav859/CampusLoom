import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./academicYears.controller.js";
import { createAcademicYearSchema, rolloverCommitSchema, rolloverPreviewSchema } from "./academicYears.schemas.js";

export const academicYearsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

academicYearsRouter.use(requireAuth);
academicYearsRouter.get("/", controller.listAcademicYears);
academicYearsRouter.get("/current", controller.getCurrentAcademicYear);
academicYearsRouter.post("/", requireRole(adminRoles), validate({ body: createAcademicYearSchema }), controller.createAcademicYear);
academicYearsRouter.post("/rollover/preview", requireRole(adminRoles), validate({ body: rolloverPreviewSchema }), controller.rolloverPreview);
academicYearsRouter.post("/rollover/commit", requireRole(adminRoles), validate({ body: rolloverCommitSchema }), controller.rolloverCommit);
