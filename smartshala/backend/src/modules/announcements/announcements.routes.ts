import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./announcements.controller.js";
import {
  announcementListQuerySchema,
  createAnnouncementSchema
} from "./announcements.schemas.js";

export const announcementsRouter = Router();

const readerRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;
const authorRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

announcementsRouter.use(requireAuth, requireRole(readerRoles));
announcementsRouter.get(
  "/",
  validate({ query: announcementListQuerySchema }),
  controller.listAnnouncements
);
announcementsRouter.post(
  "/",
  requireRole(authorRoles),
  validate({ body: createAnnouncementSchema }),
  controller.createAnnouncement
);
announcementsRouter.post("/:id/read", controller.markAsRead);
