import { prisma } from "../../core/prisma.js";
import { recordAuditLog } from "../../core/auditLog.js";
import { AppError } from "../../core/errors.js";
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

export type PeriodTimeInput = { periodNumber: number; startTime: string; endTime: string };

/**
 * The school bell. Times saved for periods beyond the current Periods Per Day
 * are not returned, so lowering that count never shows a stale row.
 */
export async function getPeriodTimes(schoolId: string) {
  const { timetablePeriodCount: periodCount } = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { timetablePeriodCount: true }
  });

  const periods = await prisma.periodTime.findMany({
    where: { schoolId, periodNumber: { lte: periodCount } },
    orderBy: { periodNumber: "asc" },
    select: { periodNumber: true, startTime: true, endTime: true }
  });

  return { periodCount, periods };
}

/**
 * Replaces the whole bell. A period may be left untimed, but each timed one
 * must end after it starts and must not start before the previous one ends.
 * "HH:mm" strings are zero-padded, so they compare correctly as text.
 */
export async function updatePeriodTimes(schoolId: string, input: PeriodTimeInput[], actorId: string) {
  const before = await getPeriodTimes(schoolId);
  const periods = [...input].sort((a, b) => a.periodNumber - b.periodNumber);

  let previous: PeriodTimeInput | null = null;
  for (const period of periods) {
    if (period.periodNumber > before.periodCount) {
      throw new AppError(
        400,
        `Period ${period.periodNumber} is beyond the ${before.periodCount} periods per day.`,
        "PERIOD_OUT_OF_RANGE"
      );
    }
    if (previous?.periodNumber === period.periodNumber) {
      throw new AppError(400, `Period ${period.periodNumber} is listed twice.`, "DUPLICATE_PERIOD");
    }
    if (period.endTime <= period.startTime) {
      throw new AppError(400, `Period ${period.periodNumber} must end after it starts.`, "INVALID_PERIOD_TIME");
    }
    if (previous && period.startTime < previous.endTime) {
      throw new AppError(
        400,
        `Period ${period.periodNumber} starts before period ${previous.periodNumber} ends.`,
        "OVERLAPPING_PERIODS"
      );
    }
    previous = period;
  }

  await prisma.$transaction([
    prisma.periodTime.deleteMany({ where: { schoolId } }),
    prisma.periodTime.createMany({ data: periods.map((period) => ({ schoolId, ...period })) })
  ]);
  const after = await getPeriodTimes(schoolId);

  await recordAuditLog({
    action: "UPDATE",
    actorId,
    entityId: schoolId,
    entityType: "SETTINGS",
    schoolId,
    summary: "Updated bell timings",
    before,
    after
  }).catch(() => undefined);

  return after;
}
