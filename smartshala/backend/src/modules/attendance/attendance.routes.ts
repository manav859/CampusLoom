import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./attendance.controller.js";
import * as reportController from "./attendance.report.controller.js";
import {
  attendanceQuerySchema,
  classTodayParamsSchema,
  markAttendanceSchema,
  studentMonthlyParamsSchema,
  studentMonthlyQuerySchema
} from "./attendance.schemas.js";

export const attendanceRouter = Router();
const attendanceRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

attendanceRouter.use(requireAuth);
attendanceRouter.get(
  "/class/:classId/today",
  requireRole(attendanceRoles),
  validate({ params: classTodayParamsSchema }),
  controller.getClassTodayAttendance
);
attendanceRouter.get(
  "/student/:studentId/month",
  requireRole(attendanceRoles),
  validate({ params: studentMonthlyParamsSchema, query: studentMonthlyQuerySchema }),
  controller.getStudentMonthlyAttendance
);
attendanceRouter.get("/dashboard", requireRole(adminRoles), controller.getAttendanceDashboard);
attendanceRouter.get("/report/classes-today", requireRole(adminRoles), reportController.getClassesTodayReport);
attendanceRouter.get("/roster", validate({ query: z.object({ classId: z.string().uuid(), date: z.coerce.date().optional() }) }), controller.getRoster);
attendanceRouter.post("/mark", validate({ body: markAttendanceSchema }), controller.markAttendance);
attendanceRouter.get("/daily", validate({ query: attendanceQuerySchema.pick({ date: true }) }), controller.dailyReport);
attendanceRouter.get("/students/:studentId/monthly", validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }) }), controller.monthlyStudentReport);
