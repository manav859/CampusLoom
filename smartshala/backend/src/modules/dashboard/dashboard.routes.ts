import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/", controller.getDashboard);

