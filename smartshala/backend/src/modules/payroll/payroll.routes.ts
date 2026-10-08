import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./payroll.controller.js";
import {
  generateSlipsSchema,
  payProfileParamsSchema,
  payProfileSchema,
  payrollMonthQuerySchema,
  salarySlipParamsSchema,
  salarySlipSchema,
  shiftSchema
} from "./payroll.schemas.js";

export const payrollRouter = Router();

const staffRoles = [UserRole.PRINCIPAL, UserRole.ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT] as const;
const managerRoles = [UserRole.PRINCIPAL, UserRole.ADMIN] as const;

payrollRouter.use(requireAuth, requireRole(staffRoles));

// Own slips only: the caller is the subject, so there is no user id to tamper with.
payrollRouter.get("/me/slips", controller.listMySlips);

payrollRouter.get("/slips", requireRole(managerRoles), validate({ query: payrollMonthQuerySchema }), controller.listMonth);
payrollRouter.put("/slips", requireRole(managerRoles), validate({ body: salarySlipSchema }), controller.saveSlip);
payrollRouter.delete(
  "/slips/:id",
  requireRole(managerRoles),
  validate({ params: salarySlipParamsSchema }),
  controller.deleteSlip
);

// Shifts and pay setup, and pay calculated from attendance against them.
payrollRouter.get("/shifts", requireRole(managerRoles), controller.listShifts);
payrollRouter.post("/shifts", requireRole(managerRoles), validate({ body: shiftSchema }), controller.createShift);
payrollRouter.patch(
  "/shifts/:id",
  requireRole(managerRoles),
  validate({ params: salarySlipParamsSchema, body: shiftSchema }),
  controller.updateShift
);
payrollRouter.delete("/shifts/:id", requireRole(managerRoles), validate({ params: salarySlipParamsSchema }), controller.deleteShift);
payrollRouter.put(
  "/profiles/:userId",
  requireRole(managerRoles),
  validate({ params: payProfileParamsSchema, body: payProfileSchema }),
  controller.savePayProfile
);
payrollRouter.get("/calculate", requireRole(managerRoles), validate({ query: payrollMonthQuerySchema }), controller.calculateMonth);
payrollRouter.post("/generate", requireRole(managerRoles), validate({ body: generateSlipsSchema }), controller.generateSlips);
