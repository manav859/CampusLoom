import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./staffAttendance.controller.js";

export const staffAttendanceRouter = Router();
const staffRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;

staffAttendanceRouter.use(requireAuth, requireRole(staffRoles));
staffAttendanceRouter.get("/me/today", controller.getTodayStatus);
staffAttendanceRouter.get(
  "/me/history",
  validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }) }),
  controller.getMyHistory
);
staffAttendanceRouter.post("/me/punch-in", controller.punchIn);
staffAttendanceRouter.post("/me/punch-out", controller.punchOut);
