import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { attendanceRouter } from "../modules/attendance/attendance.routes.js";
import { classesRouter } from "../modules/classes/classes.routes.js";
import { communicationRouter } from "../modules/communication/communication.routes.js";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { feesRouter } from "../modules/fees/fees.routes.js";
import { homeworkRouter } from "../modules/homework/homework.routes.js";
import { marksRouter } from "../modules/marks/marks.routes.js";
import { analyticsRouter } from "../modules/analytics/analytics.routes.js";
import { notificationsRouter } from "../modules/notifications/notifications.routes.js";
import { reportsRouter } from "../modules/reports/reports.routes.js";
import { studentsRouter } from "../modules/students/students.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";
import { whatsappRouter } from "../modules/whatsapp/whatsapp.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "smartshala-api", version: "1.0.0" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/classes", classesRouter);
apiRouter.use("/communication", communicationRouter);
apiRouter.use("/students", studentsRouter);
apiRouter.use("/attendance", attendanceRouter);
apiRouter.use("/homework", homeworkRouter);
apiRouter.use("/marks", marksRouter);
apiRouter.use("/fees", feesRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/wa", whatsappRouter);
