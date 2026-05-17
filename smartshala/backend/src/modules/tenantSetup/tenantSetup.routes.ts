import { Router } from "express";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../core/asyncHandler.js";
import { AppError } from "../../core/errors.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { registerExistingTenantSchema } from "./tenantSetup.schemas.js";

export const tenantSetupRouter = Router();

tenantSetupRouter.post(
  "/register-existing",
  requireAuth,
  requireRole(UserRole.PRINCIPAL, UserRole.ADMIN),
  validate({ body: registerExistingTenantSchema }),
  asyncHandler(async (req, res) => {
    if (!isMasterDbConfigured()) {
      throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");
    }

    const input = req.body;

    // Registers the current single-school database as the first tenant.
    // This is idempotent and only updates master metadata; school ERP data stays untouched.
    const school = await masterPrisma.school.upsert({
      where: { schoolId: input.schoolId },
      update: {
        schoolName: input.schoolName,
        ownerName: input.ownerName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        numberOfStudents: input.numberOfStudents,
        numberOfStaff: input.numberOfStaff,
        dbName: input.dbName,
        dbUrl: env.DATABASE_URL,
        directDbUrl: env.DIRECT_URL,
        isActive: true,
        isTrial: false,
        paymentStatus: "PAID",
        amountPaid: 20000
      },
      create: {
        schoolId: input.schoolId,
        schoolName: input.schoolName,
        ownerName: input.ownerName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        numberOfStudents: input.numberOfStudents,
        numberOfStaff: input.numberOfStaff,
        planType: "STANDARD",
        paymentStatus: "PAID",
        amountPaid: 20000,
        isTrial: false,
        isActive: true,
        dbName: input.dbName,
        dbUrl: env.DATABASE_URL,
        directDbUrl: env.DIRECT_URL
      }
    });

    await masterPrisma.onboardingLog.create({
      data: {
        schoolId: input.schoolId,
        status: "EXISTING_REGISTERED",
        message: `Registered existing database ${input.dbName} as tenant ${input.schoolId}`
      }
    });

    res.status(201).json({
      status: "ok",
      schoolId: school.schoolId,
      dbName: school.dbName,
      isActive: school.isActive
    });
  })
);
