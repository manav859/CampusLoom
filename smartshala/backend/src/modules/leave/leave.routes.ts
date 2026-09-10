import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./leave.controller.js";
import { applyLeaveSchema, leaveDecisionSchema, leaveListQuerySchema } from "./leave.schemas.js";

export const leaveRouter = Router();

const staffRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;
const approverRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

leaveRouter.use(requireAuth, requireRole(staffRoles));

// Any staff member applies for their own leave; the row is always attributed to
// the caller, so there is no "on behalf of" path to guard.
leaveRouter.post(
  "/requests",
  upload.single("attachment"),
  validate({ body: applyLeaveSchema }),
  controller.applyForLeave
);

// Must precede "/requests/:id/..." or "me" would be read as a request id.
leaveRouter.get(
  "/requests/me",
  validate({ query: leaveListQuerySchema }),
  controller.listMyLeave
);

leaveRouter.get(
  "/requests",
  requireRole(approverRoles),
  validate({ query: leaveListQuerySchema }),
  controller.listSchoolLeave
);

leaveRouter.get("/requests/:id/attachment", controller.downloadAttachment);

leaveRouter.patch(
  "/requests/:id/decision",
  requireRole(approverRoles),
  validate({ body: leaveDecisionSchema }),
  controller.decideLeave
);

leaveRouter.patch("/requests/:id/cancel", controller.cancelLeave);
