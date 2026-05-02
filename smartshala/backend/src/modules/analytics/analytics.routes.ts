import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./analytics.controller.js";

export const analyticsRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

analyticsRouter.use(requireAuth, requireRole(adminRoles));
analyticsRouter.get("/risk-summary", controller.riskSummary);
analyticsRouter.get("/classes", controller.classPerformance);
