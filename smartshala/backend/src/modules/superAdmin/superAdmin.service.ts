import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserStatus } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import { PasswordResetStatus, PaymentStatus, TenantDeletionStatus } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { logger } from "../../config/logger.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { getTenantPrismaClient } from "../../tenant/prismaManager.js";
import { expireTrials, trialEndsFrom } from "../../services/trial.service.js";

function assertSuperAdminConfigured() {
  if (!env.SUPER_ADMIN_EMAIL || (!env.SUPER_ADMIN_PASSWORD && !env.SUPER_ADMIN_PASSWORD_HASH)) {
    throw new AppError(
      503,
      "Super admin is not configured. Add SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD_HASH in Render.",
      "SUPER_ADMIN_NOT_CONFIGURED"
    );
  }
}

function assertMasterConfigured() {
  if (!isMasterDbConfigured()) {
    throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }
}

async function tenantSchoolOrThrow(schoolId: string) {
  assertMasterConfigured();
  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");
  return school;
}

export async function loginSuperAdmin(email: string, password: string) {
  assertSuperAdminConfigured();

  if (email.toLowerCase() !== env.SUPER_ADMIN_EMAIL!.toLowerCase()) {
    throw new AppError(401, "Invalid credentials", "INVALID_SUPER_ADMIN_CREDENTIALS");
  }

  const valid = env.SUPER_ADMIN_PASSWORD_HASH
    ? await bcrypt.compare(password, env.SUPER_ADMIN_PASSWORD_HASH)
    : password === env.SUPER_ADMIN_PASSWORD;

  if (!valid) throw new AppError(401, "Invalid credentials", "INVALID_SUPER_ADMIN_CREDENTIALS");

  const token = jwt.sign(
    {
      kind: "SUPER_ADMIN",
      email: env.SUPER_ADMIN_EMAIL
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "8h", subject: "super-admin" }
  );

  return {
    accessToken: token,
    user: {
      email: env.SUPER_ADMIN_EMAIL,
      role: "SUPER_ADMIN"
    }
  };
}

export async function listSchoolsForSuperAdmin() {
  assertMasterConfigured();
  await expireTrials();
  const schools = await masterPrisma.school.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      schoolId: true,
      schoolName: true,
      ownerName: true,
      email: true,
      phone: true,
      planType: true,
      paymentStatus: true,
      isTrial: true,
      trialEndsAt: true,
      isActive: true,
      dbName: true,
      deletionStatus: true,
      deletionScheduledAt: true,
      createdAt: true
    }
  });

  return schools;
}

export async function listSchoolUsers(schoolId: string) {
  const school = await tenantSchoolOrThrow(schoolId);
  const tenantPrisma = getTenantPrismaClient(school.dbUrl);

  const users = await tenantPrisma.user.findMany({
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      school: {
        select: {
          name: true,
          code: true
        }
      }
    }
  });

  return {
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      dbName: school.dbName,
      isActive: school.isActive
    },
    users
  };
}

export async function listPasswordResetRequests() {
  assertMasterConfigured();
  return masterPrisma.passwordResetRequest.findMany({
    where: { status: PasswordResetStatus.PENDING },
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: {
      school: {
        select: {
          schoolName: true,
          dbName: true,
          isActive: true
        }
      }
    }
  });
}

export async function updateTenantUserStatus(schoolId: string, userId: string, isActive: boolean) {
  const school = await tenantSchoolOrThrow(schoolId);
  const tenantPrisma = getTenantPrismaClient(school.dbUrl);

  return tenantPrisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      status: isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      isActive: true
    }
  });
}

export async function resetTenantUserPassword(schoolId: string, userId: string, password: string) {
  const school = await tenantSchoolOrThrow(schoolId);
  const tenantPrisma = getTenantPrismaClient(school.dbUrl);
  const passwordHash = await bcrypt.hash(password, 10);

  await tenantPrisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  return tenantPrisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      isActive: true
    }
  });
}

export async function completePasswordResetRequest(requestId: string, password: string, completedBy: string) {
  assertMasterConfigured();
  const request = await masterPrisma.passwordResetRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AppError(404, "Password reset request not found", "PASSWORD_RESET_REQUEST_NOT_FOUND");
  if (request.status !== PasswordResetStatus.PENDING) {
    throw new AppError(409, "Password reset request is no longer pending", "PASSWORD_RESET_REQUEST_NOT_PENDING");
  }

  await resetTenantUserPassword(request.schoolId, request.userId, password);
  return masterPrisma.passwordResetRequest.update({
    where: { id: requestId },
    data: {
      status: PasswordResetStatus.COMPLETED,
      completedAt: new Date(),
      completedBy
    },
    include: {
      school: {
        select: {
          schoolName: true,
          dbName: true,
          isActive: true
        }
      }
    }
  });
}

export async function dismissPasswordResetRequest(requestId: string, completedBy: string) {
  assertMasterConfigured();
  return masterPrisma.passwordResetRequest.update({
    where: { id: requestId },
    data: {
      status: PasswordResetStatus.DISMISSED,
      completedAt: new Date(),
      completedBy
    },
    include: {
      school: {
        select: {
          schoolName: true,
          dbName: true,
          isActive: true
        }
      }
    }
  });
}

export async function updateTenantUserRole(schoolId: string, userId: string, role: UserRole) {
  const school = await tenantSchoolOrThrow(schoolId);
  const tenantPrisma = getTenantPrismaClient(school.dbUrl);

  return tenantPrisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      isActive: true
    }
  });
}

export async function updateSchoolActiveStatus(schoolId: string, isActive: boolean) {
  assertMasterConfigured();
  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");

  const now = new Date();
  const startsTrial = isActive && school.isTrial && (!school.trialEndsAt || school.trialEndsAt <= now);

  return masterPrisma.school.update({
    where: { schoolId },
    data: {
      isActive,
      ...(startsTrial ? { trialEndsAt: trialEndsFrom(now), paymentStatus: PaymentStatus.TRIAL } : {}),
      ...(!isActive ? { deletionStatus: school.deletionStatus } : {})
    },
    select: {
      schoolId: true,
      schoolName: true,
      isActive: true,
      dbName: true,
      paymentStatus: true,
      isTrial: true,
      trialEndsAt: true
    }
  });
}

export async function extendSchoolAccess(schoolId: string, days: number) {
  assertMasterConfigured();
  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");

  const now = new Date();
  const base = school.trialEndsAt && school.trialEndsAt > now ? school.trialEndsAt : now;
  const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  return masterPrisma.school.update({
    where: { schoolId },
    data: {
      isActive: true,
      isTrial: true,
      paymentStatus: PaymentStatus.TRIAL,
      trialEndsAt
    },
    select: {
      schoolId: true,
      schoolName: true,
      isActive: true,
      dbName: true,
      paymentStatus: true,
      isTrial: true,
      trialEndsAt: true
    }
  });
}

export async function deleteSchool(schoolId: string) {
  assertMasterConfigured();
  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");

  if (school.deletionStatus === TenantDeletionStatus.DELETED) {
    throw new AppError(409, "School is already deleted", "SCHOOL_ALREADY_DELETED");
  }

  // Try to drop the Neon database if configured
  if (env.NEON_API_KEY && env.NEON_PROJECT_ID && env.NEON_BRANCH_ID) {
    try {
      const url = `https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}/branches/${env.NEON_BRANCH_ID}/databases/${encodeURIComponent(school.dbName)}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${env.NEON_API_KEY}`
        }
      });
      if (!response.ok && response.status !== 404 && response.status !== 204) {
        logger.warn({ status: response.status, dbName: school.dbName }, "Neon database deletion returned non-ok status during super admin delete");
      }
    } catch (error) {
      logger.warn({ err: error, dbName: school.dbName }, "Neon database deletion failed during super admin delete — continuing with record cleanup");
    }
  }

  const now = new Date();
  const updated = await masterPrisma.school.update({
    where: { schoolId },
    data: {
      isActive: false,
      deletionStatus: TenantDeletionStatus.DELETED,
      deletionExecutedAt: now,
      deletionRequestedAt: school.deletionRequestedAt ?? now,
      deletionScheduledAt: null
    },
    select: {
      schoolId: true,
      schoolName: true,
      isActive: true,
      dbName: true,
      deletionStatus: true
    }
  });

  await masterPrisma.onboardingLog.create({
    data: {
      schoolId,
      status: "DATABASE_DELETED",
      message: `School ${school.schoolName} (${school.dbName}) deleted by super admin`
    }
  }).catch(() => undefined);

  logger.warn({ schoolId, dbName: school.dbName }, "School deleted by super admin");
  return updated;
}
