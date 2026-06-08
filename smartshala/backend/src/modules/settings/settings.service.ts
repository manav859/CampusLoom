import { prisma } from "../../core/prisma.js";
import { recordAuditLog } from "../../core/auditLog.js";
import { isMasterDbConfigured, masterPrisma } from "../../master-db/masterPrisma.js";
import { getTenantContext } from "../../tenant/tenantContext.js";

export type SchoolProfileInput = {
  name: string;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  udiseNumber?: string | null;
  affiliationBoard?: string | null;
  logoUrl?: string | null;
  timetablePeriodCount?: number;
};

const schoolProfileSelect = {
  id: true,
  name: true,
  code: true,
  city: true,
  state: true,
  phone: true,
  udiseNumber: true,
  affiliationBoard: true,
  logoUrl: true,
  timetablePeriodCount: true
} as const;

export async function getSchoolProfile(schoolId: string) {
  return prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: schoolProfileSelect
  });
}

export async function updateSchoolProfile(schoolId: string, input: SchoolProfileInput, actorId: string) {
  const before = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: schoolProfileSelect
  });

  const updatedSchool = await prisma.school.update({
    where: { id: schoolId },
    data: input,
    select: schoolProfileSelect
  });

  await recordAuditLog({
    action: "UPDATE",
    actorId,
    entityId: schoolId,
    entityType: "SETTINGS",
    schoolId,
    summary: "Updated school profile",
    before,
    after: updatedSchool
  }).catch(() => undefined);

  if (isMasterDbConfigured()) {
    const tenantSchoolId = getTenantContext()?.schoolId;
    if (tenantSchoolId) {
      await masterPrisma.school.update({
        where: { schoolId: tenantSchoolId },
        data: {
          schoolName: input.name,
          phone: input.phone ?? ""
        }
      }).catch((err) => {
        console.error(`[SettingsSync] Failed to sync school details to master DB for schoolId ${tenantSchoolId}:`, err);
      });
    }
  }

  return updatedSchool;
}
