import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./reports.controller.js";

export const reportsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

reportsRouter.use(requireAuth);
reportsRouter.get("/daily-principal", requireRole(adminRoles), controller.dailyPrincipalReport);
reportsRouter.get("/fees/pending", requireRole(adminRoles), controller.feePending);
reportsRouter.get("/risk", requireRole(adminRoles), controller.risk);
reportsRouter.get("/classes", requireRole(adminRoles), controller.classReport);
reportsRouter.get(
  "/students/:studentId/monthly",
  requireRole(adminRoles),
  validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }) }),
  controller.monthlyStudent
);
