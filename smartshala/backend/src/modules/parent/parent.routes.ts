import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./parent.controller.js";
import {
  announcementsQuerySchema,
  calendarQuerySchema,
  childAttendanceQuerySchema,
  childDocumentParamsSchema,
  childParamsSchema,
  childReceiptParamsSchema,
  feePayLinkSchema
} from "./parent.schemas.js";

export const parentRouter = Router();

// Everything here is parent-only and tenant-scoped.
parentRouter.use(requireAuth, requireRole(UserRole.PARENT));

parentRouter.get("/children", controller.listChildren);
parentRouter.get(
  "/children/:id/home",
  validate({ params: childParamsSchema }),
  controller.childHome
);
parentRouter.get(
  "/children/:id/attendance",
  validate({ params: childParamsSchema, query: childAttendanceQuerySchema }),
  controller.childAttendance
);
parentRouter.get(
  "/children/:id/academics",
  validate({ params: childParamsSchema }),
  controller.childAcademics
);
parentRouter.get(
  "/children/:id/homework",
  validate({ params: childParamsSchema }),
  controller.childHomework
);
parentRouter.get(
  "/children/:id/fees",
  validate({ params: childParamsSchema }),
  controller.childFees
);
parentRouter.post(
  "/children/:id/fees/pay-link",
  validate({ params: childParamsSchema, body: feePayLinkSchema }),
  controller.createFeePayLink
);
parentRouter.get(
  "/children/:id/fees/receipts/:paymentId/pdf",
  validate({ params: childReceiptParamsSchema }),
  controller.childFeeReceiptPdf
);
parentRouter.get(
  "/calendar",
  validate({ query: calendarQuerySchema }),
  controller.schoolCalendar
);
parentRouter.get(
  "/announcements",
  validate({ query: announcementsQuerySchema }),
  controller.announcements
);
parentRouter.get(
  "/children/:id/documents",
  validate({ params: childParamsSchema }),
  controller.childDocuments
);
parentRouter.get(
  "/children/:id/documents/:documentId/download",
  validate({ params: childDocumentParamsSchema }),
  controller.childDocumentDownload
);
