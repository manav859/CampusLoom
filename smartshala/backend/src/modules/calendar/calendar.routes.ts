import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./calendar.controller.js";
import {
  calendarEventParamsSchema,
  calendarEventSchema,
  calendarMonthQuerySchema
} from "./calendar.schemas.js";

export const calendarRouter = Router();

const readerRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;
const editorRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

calendarRouter.use(requireAuth, requireRole(readerRoles));
calendarRouter.get("/", validate({ query: calendarMonthQuerySchema }), controller.listMonth);
calendarRouter.post(
  "/events",
  requireRole(editorRoles),
  validate({ body: calendarEventSchema }),
  controller.createEvent
);
calendarRouter.patch(
  "/events/:id",
  requireRole(editorRoles),
  validate({ params: calendarEventParamsSchema, body: calendarEventSchema }),
  controller.updateEvent
);
calendarRouter.delete(
  "/events/:id",
  requireRole(editorRoles),
  validate({ params: calendarEventParamsSchema }),
  controller.deleteEvent
);
