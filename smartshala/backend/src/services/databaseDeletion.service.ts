import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { TenantDeletionStatus } from "../../node_modules/@smartshala/master-client/index.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../core/errors.js";
import { prisma } from "../core/prisma.js";
import { isMasterDbConfigured, masterPrisma } from "../master-db/masterPrisma.js";

const DELETION_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
const WORKER_INTERVAL_MS = 60 * 60 * 1000;

function assertTenantDeletionConfigured() {
  if (!isMasterDbConfigured()) {
    throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");
  }
}

function assertNeonDeleteConfigured() {
  const missing = ["NEON_API_KEY", "NEON_PROJECT_ID", "NEON_BRANCH_ID"].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new AppError(
      503,
      `Neon deletion is not configured. Missing: ${missing.join(", ")}`,
      "NEON_DELETION_CONFIG_MISSING"
    );
  }
}

async function verifyCurrentUserPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, isActive: true, status: true }
  });

  if (!user || !user.isActive || user.status !== "ACTIVE") {
    throw new AppError(401, "Current user is no longer active", "AUTH_REQUIRED");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError(401, "Password is incorrect", "INVALID_PASSWORD");
  }
}

export async function getTenantDeletionStatus(schoolId: string) {
  assertTenantDeletionConfigured();
  const school = await masterPrisma.school.findUnique({
    where: { schoolId },
    select: {
      schoolId: true,
      dbName: true,
      deletionStatus: true,
      deletionRequestedAt: true,
      deletionScheduledAt: true,
      deletionCancelledAt: true,
      deletionExecutedAt: true
    }
  });

  if (!school) throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");
  return school;
}

export async function requestTenantDeletion(input: {
  schoolId: string;
  requestedByUserId: string;
  requestedByRole: UserRole;
  password: string;
}) {
  assertTenantDeletionConfigured();
  assertNeonDeleteConfigured();

  await verifyCurrentUserPassword(input.requestedByUserId, input.password);

  const now = new Date();
  const scheduledAt = new Date(now.getTime() + DELETION_DELAY_MS);

  const school = await masterPrisma.school.update({
    where: { schoolId: input.schoolId },
    data: {
      deletionStatus: TenantDeletionStatus.PENDING,
      deletionRequestedAt: now,
      deletionScheduledAt: scheduledAt,
      deletionCancelledAt: null,
      deletionExecutedAt: null,
      deletionRequestedBy: input.requestedByUserId
    },
    select: {
      schoolId: true,
      dbName: true,
      deletionStatus: true,
      deletionRequestedAt: true,
      deletionScheduledAt: true
    }
  });

  await masterPrisma.onboardingLog.create({
    data: {
      schoolId: input.schoolId,
      status: "DELETION_SCHEDULED",
      message: `Database ${school.dbName} scheduled for deletion at ${scheduledAt.toISOString()} by ${input.requestedByRole}`
    }
  });

  logger.warn({ schoolId: input.schoolId, dbName: school.dbName, scheduledAt }, "Tenant database deletion scheduled");
  return school;
}

export async function cancelTenantDeletion(input: { schoolId: string; cancelledByUserId: string; password: string }) {
  assertTenantDeletionConfigured();
  await verifyCurrentUserPassword(input.cancelledByUserId, input.password);

  const now = new Date();
  const school = await masterPrisma.school.update({
    where: { schoolId: input.schoolId },
    data: {
      deletionStatus: TenantDeletionStatus.CANCELLED,
      deletionCancelledAt: now,
      deletionScheduledAt: null
    },
    select: {
      schoolId: true,
      dbName: true,
      deletionStatus: true,
      deletionRequestedAt: true,
      deletionScheduledAt: true,
      deletionCancelledAt: true
    }
  });

  await masterPrisma.onboardingLog.create({
    data: {
      schoolId: input.schoolId,
      status: "DELETION_CANCELLED",
      message: `Database deletion cancelled by ${input.cancelledByUserId}`
    }
  });

  logger.info({ schoolId: input.schoolId, dbName: school.dbName }, "Tenant database deletion cancelled");
  return school;
}

async function deleteNeonDatabase(databaseName: string) {
  assertNeonDeleteConfigured();

  const url = `https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}/branches/${env.NEON_BRANCH_ID}/databases/${encodeURIComponent(databaseName)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.NEON_API_KEY}`
    }
  });

  if (!response.ok && response.status !== 404 && response.status !== 204) {
    logger.error({ status: response.status, body: await response.text(), databaseName }, "Neon database deletion failed");
    throw new Error(`Neon database deletion failed for ${databaseName}`);
  }
}

export async function processDueTenantDeletions() {
  if (!isMasterDbConfigured()) return;
  if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID || !env.NEON_BRANCH_ID) return;

  const dueSchools = await masterPrisma.school.findMany({
    where: {
      deletionStatus: TenantDeletionStatus.PENDING,
      deletionScheduledAt: { lte: new Date() }
    },
    select: { schoolId: true, dbName: true }
  });

  for (const school of dueSchools) {
    try {
      await deleteNeonDatabase(school.dbName);
      await masterPrisma.school.update({
        where: { schoolId: school.schoolId },
        data: {
          isActive: false,
          deletionStatus: TenantDeletionStatus.DELETED,
          deletionExecutedAt: new Date()
        }
      });
      await masterPrisma.onboardingLog.create({
        data: {
          schoolId: school.schoolId,
          status: "DATABASE_DELETED",
          message: `Database ${school.dbName} deleted after 3-day cancellation window`
        }
      });
      logger.warn({ schoolId: school.schoolId, dbName: school.dbName }, "Tenant database deleted");
    } catch (error) {
      await masterPrisma.school.update({
        where: { schoolId: school.schoolId },
        data: { deletionStatus: TenantDeletionStatus.FAILED }
      });
      logger.error({ err: error, schoolId: school.schoolId, dbName: school.dbName }, "Tenant database deletion worker failed");
    }
  }
}

export function startDatabaseDeletionWorker() {
  if (env.NODE_ENV === "test") return;

  void processDueTenantDeletions();
  const timer = setInterval(() => {
    void processDueTenantDeletions();
  }, WORKER_INTERVAL_MS);

  timer.unref?.();
}
