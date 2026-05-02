import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./fees.controller.js";
import { assignFeeSchema, feeStructureSchema, paymentSchema } from "./fees.schemas.js";

export const feesRouter = Router();
const adminRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;
const financeRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.ACCOUNTANT] as const;

feesRouter.use(requireAuth);
feesRouter.get("/dashboard", requireRole(financeRoles), controller.dashboard);
feesRouter.get("/structure", requireRole(financeRoles), controller.listFeeStructures);
feesRouter.post("/structure", requireRole(adminRoles), validate({ body: feeStructureSchema }), controller.createFeeStructure);
feesRouter.get("/structure/:id", requireRole(financeRoles), controller.getFeeStructure);
feesRouter.post("/structure/:id/assign", requireRole(adminRoles), controller.assignFeeStructureToClass);
feesRouter.post("/payment", requireRole(financeRoles), validate({ body: paymentSchema }), controller.collectPayment);
feesRouter.get("/student/:studentId", requireRole(financeRoles), controller.getStudentLedger);
feesRouter.get("/structures", requireRole(financeRoles), controller.listFeeStructures);
feesRouter.post("/structures", requireRole(adminRoles), validate({ body: feeStructureSchema }), controller.createFeeStructure);
feesRouter.get("/structures/:id", requireRole(financeRoles), controller.getFeeStructure);
feesRouter.post("/structures/:id/assign", requireRole(adminRoles), controller.assignFeeStructureToClass);
feesRouter.post("/assignments", requireRole(adminRoles), validate({ body: assignFeeSchema }), controller.assignFee);
feesRouter.post("/payments", requireRole(financeRoles), validate({ body: paymentSchema }), controller.collectPayment);
feesRouter.get("/students/:studentId/ledger", requireRole(financeRoles), controller.getStudentLedger);
feesRouter.get("/defaulters", requireRole(financeRoles), controller.defaulters);
feesRouter.get("/receipts/:receiptId/pdf", requireRole(financeRoles), controller.receiptPdf);
