import { env } from "../config/env.js";
import { AppError } from "../core/errors.js";
import { prisma } from "../core/prisma.js";
import { masterPrisma } from "../master-db/masterPrisma.js";
import { legacyTenantSchoolId } from "./legacyTenant.js";
import { isValidSchoolId } from "../utils/generateSchoolId.js";

/**
 * Options.allowSuspended lets a lapsed tenant through so its principal can still
 * sign in and settle the bill. Callers get `suspended: true` and must gate every
 * route except auth and billing on it — see tenant.middleware.ts.
 */
export async function resolveTenant(schoolId: string, options: { allowSuspended?: boolean } = {}) {
  if (!isValidSchoolId(schoolId)) {
    throw new AppError(400, "Invalid school ID", "INVALID_SCHOOL_ID");
  }

  if (!env.MASTER_DATABASE_URL) return resolveLegacyTenant(schoolId);

  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) return resolveLegacyTenant(schoolId);

  const trialExpired = Boolean(school.isTrial && school.trialEndsAt && school.trialEndsAt <= new Date());
  const suspended = !school.isActive || trialExpired;
  if (suspended && !options.allowSuspended) {
    throw new AppError(402, "School subscription is inactive or expired", "SCHOOL_INACTIVE");
  }
  if (suspended && school.deletionStatus === "DELETED") {
    throw new AppError(410, "This school has been deleted", "SCHOOL_DELETED");
  }

  return { ...school, suspended };
}

async function resolveLegacyTenant(schoolId: string) {
  const schools = await prisma.school.findMany({
    select: { id: true, code: true, name: true },
    take: 50
  });
  const school = schools.find((item) => legacyTenantSchoolId(item) === schoolId);

  if (!school) {
    if (!env.MASTER_DATABASE_URL) {
      throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");
    }
    throw new AppError(404, "School not found", "SCHOOL_NOT_FOUND");
  }

  return {
    schoolId,
    schoolName: school.name,
    dbName: "legacy",
    dbUrl: env.DATABASE_URL,
    isActive: true,
    isTrial: false,
    trialEndsAt: null,
    suspended: false
  };
}
