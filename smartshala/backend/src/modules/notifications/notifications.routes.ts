import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./notifications.controller.js";
import { queueNotificationSchema } from "./notifications.schemas.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth, requireRole(UserRole.ADMIN));
notificationsRouter.get("/", controller.listNotifications);
notificationsRouter.post("/", validate({ body: queueNotificationSchema }), controller.queueNotification);

