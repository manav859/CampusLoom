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

// The principal's view of one staff member's month, for the Teacher Profile.
staffAttendanceRouter.get(
  "/users/:id/summary",
  requireRole([UserRole.PRINCIPAL, UserRole.ADMIN]),
  validate({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
  }),
  controller.getStaffMonthSummary
);

// The principal's view of every teacher's punch on one day.
staffAttendanceRouter.get(
  "/day",
  requireRole([UserRole.PRINCIPAL, UserRole.ADMIN]),
  validate({ query: z.object({ date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/) }) }),
  controller.getStaffDay
);
