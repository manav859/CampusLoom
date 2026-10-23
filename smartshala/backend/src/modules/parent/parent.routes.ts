import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./parent.controller.js";
import { childAttendanceQuerySchema, childParamsSchema } from "./parent.schemas.js";

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
