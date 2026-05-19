import { env } from "../config/env.js";
import { AppError } from "../core/errors.js";
import { prisma } from "../core/prisma.js";
import { masterPrisma } from "../master-db/masterPrisma.js";
import { legacyTenantSchoolId } from "./legacyTenant.js";
import { isValidSchoolId } from "../utils/generateSchoolId.js";

export async function resolveTenant(schoolId: string) {
  if (!isValidSchoolId(schoolId)) {
    throw new AppError(400, "Invalid school ID", "INVALID_SCHOOL_ID");
  }

  if (!env.MASTER_DATABASE_URL) return resolveLegacyTenant(schoolId);

  const school = await masterPrisma.school.findUnique({ where: { schoolId } });
  if (!school) return resolveLegacyTenant(schoolId);

  const trialExpired = Boolean(school.isTrial && school.trialEndsAt && school.trialEndsAt <= new Date());
  if (!school.isActive || trialExpired) {
    throw new AppError(402, "School subscription is inactive or expired", "SCHOOL_INACTIVE");
  }

  return school;
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
    trialEndsAt: null
  };
}
