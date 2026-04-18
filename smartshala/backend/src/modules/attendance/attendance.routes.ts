import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./attendance.controller.js";
import { attendanceQuerySchema, markAttendanceSchema } from "./attendance.schemas.js";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);
attendanceRouter.get("/roster", validate({ query: z.object({ classId: z.string().uuid(), date: z.coerce.date().optional() }) }), controller.getRoster);
attendanceRouter.post("/mark", validate({ body: markAttendanceSchema }), controller.markAttendance);
attendanceRouter.get("/daily", validate({ query: attendanceQuerySchema.pick({ date: true }) }), controller.dailyReport);
attendanceRouter.get("/students/:studentId/monthly", validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }) }), controller.monthlyStudentReport);

