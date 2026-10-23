import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./parent.controller.js";

export const parentRouter = Router();

// Everything here is parent-only and tenant-scoped.
parentRouter.use(requireAuth, requireRole(UserRole.PARENT));

parentRouter.get("/children", controller.listChildren);
