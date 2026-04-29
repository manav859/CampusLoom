import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./fees.controller.js";
import { assignFeeSchema, feeStructureSchema, paymentSchema } from "./fees.schemas.js";

export const feesRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

feesRouter.use(requireAuth);
feesRouter.get("/dashboard", requireRole(adminRoles), controller.dashboard);
feesRouter.get("/structure", requireRole(adminRoles), controller.listFeeStructures);
feesRouter.post("/structure", requireRole(adminRoles), validate({ body: feeStructureSchema }), controller.createFeeStructure);
feesRouter.get("/structure/:id", requireRole(adminRoles), controller.getFeeStructure);
feesRouter.post("/structure/:id/assign", requireRole(adminRoles), controller.assignFeeStructureToClass);
feesRouter.post("/payment", requireRole(adminRoles), validate({ body: paymentSchema }), controller.collectPayment);
feesRouter.get("/student/:studentId", requireRole(adminRoles), controller.getStudentLedger);
feesRouter.get("/structures", requireRole(adminRoles), controller.listFeeStructures);
feesRouter.post("/structures", requireRole(adminRoles), validate({ body: feeStructureSchema }), controller.createFeeStructure);
feesRouter.get("/structures/:id", requireRole(adminRoles), controller.getFeeStructure);
feesRouter.post("/structures/:id/assign", requireRole(adminRoles), controller.assignFeeStructureToClass);
feesRouter.post("/assignments", requireRole(adminRoles), validate({ body: assignFeeSchema }), controller.assignFee);
feesRouter.post("/payments", requireRole(adminRoles), validate({ body: paymentSchema }), controller.collectPayment);
feesRouter.get("/students/:studentId/ledger", requireRole(adminRoles), controller.getStudentLedger);
feesRouter.get("/defaulters", requireRole(adminRoles), controller.defaulters);
feesRouter.get("/receipts/:receiptId/pdf", requireRole(adminRoles), controller.receiptPdf);
