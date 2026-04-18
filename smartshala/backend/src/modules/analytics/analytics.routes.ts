import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);
analyticsRouter.get("/risk-summary", controller.riskSummary);
analyticsRouter.get("/classes", controller.classPerformance);

