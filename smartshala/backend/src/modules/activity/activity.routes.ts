import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./activity.controller.js";

export const activityRouter = Router();

activityRouter.use(requireAuth);
activityRouter.get("/", requireRole([UserRole.PRINCIPAL, UserRole.ADMIN]), controller.listActivityLogs);
