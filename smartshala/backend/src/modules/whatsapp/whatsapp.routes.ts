import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./whatsapp.controller.js";

export const whatsappRouter = Router();

const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;
const sendMessageSchema = z.object({
  phone: z.string().trim().min(10),
  message: z.string().trim().min(1)
});
const sendBulkSchema = z.array(sendMessageSchema).min(1);
const statsQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
});

whatsappRouter.use(requireAuth, requireRole(adminRoles));
whatsappRouter.post("/send", validate({ body: sendMessageSchema }), controller.sendMessage);
whatsappRouter.post("/bulk", validate({ body: sendBulkSchema }), controller.sendBulk);
whatsappRouter.get("/stats", validate({ query: statsQuerySchema }), controller.getStats);
whatsappRouter.get("/logs", controller.getLogs);
whatsappRouter.delete("/logs", controller.clearNotifications);
whatsappRouter.post("/logs/:id/retry", validate({ params: z.object({ id: z.string().uuid() }) }), controller.retryNotification);
whatsappRouter.delete("/logs/:id", validate({ params: z.object({ id: z.string().uuid() }) }), controller.deleteNotification);
