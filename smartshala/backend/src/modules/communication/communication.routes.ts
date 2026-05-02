import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./communication.controller.js";
import { communicationListQuerySchema, sendTeacherMessageSchema } from "./communication.schemas.js";

export const communicationRouter = Router();
const communicationRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER] as const;

communicationRouter.use(requireAuth, requireRole(communicationRoles));
communicationRouter.get("/context", controller.context);
communicationRouter.get("/messages", validate({ query: communicationListQuerySchema }), controller.listMessages);
communicationRouter.post("/messages", validate({ body: sendTeacherMessageSchema }), controller.sendMessage);
