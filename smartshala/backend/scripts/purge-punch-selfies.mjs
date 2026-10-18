#!/usr/bin/env node
// Deletes punch selfies older than a retention window, across every active
// tenant. The photo is evidence that someone turned up on a given morning; a
// week later it is just a picture of an employee's face sitting in storage, so
// the file is removed and the row keeps only the punch times.
//
//   node scripts/purge-punch-selfies.mjs            # 7 days
//   node scripts/purge-punch-selfies.mjs --days 30
//   node scripts/purge-punch-selfies.mjs --dry-run
//
// Background workers are off in production, so this runs from cron. It needs
// the same env as the API (for S3 credentials, when S3 is configured).
import "dotenv/config";
import { PrismaClient as MasterClient } from "../node_modules/@smartshala/master-client/index.js";
import { PrismaClient } from "@prisma/client";
import { deleteFile } from "../dist/services/storageService.js";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const days = Number(arg("--days", 7));
const dryRun = process.argv.includes("--dry-run");

if (!Number.isInteger(days) || days < 1) {
  console.error(`--days must be a whole number of days, got "${days}"`);
  process.exit(64);
}

/** Midnight N days ago: a selfie is kept for its whole final day. */
function cutoffDate() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

async function purgeTenant(school, cutoff) {
  if (!school.dbUrl) return { schoolId: school.schoolId, skipped: "missing dbUrl" };

  const tenant = new PrismaClient({ datasources: { db: { url: school.dbUrl } } });
  let cleared = 0;
  let failed = 0;

  try {
    const stale = await tenant.staffAttendance.findMany({
      where: { selfieKey: { not: null }, date: { lt: cutoff } },
      select: { id: true, selfieKey: true }
    });

    for (const row of stale) {
      if (dryRun) {
        cleared++;
        continue;
      }

      // Clear the columns even when the file is already gone, otherwise a
      // missing object keeps the row looking like it still has a selfie and
      // every later run retries it forever.
      try {
        await deleteFile(row.selfieKey);
      } catch (error) {
        failed++;
        console.warn(`  ${school.schoolId}: could not delete ${row.selfieKey}: ${error?.message ?? error}`);
      }

      await tenant.staffAttendance.update({
        where: { id: row.id },
        data: { selfieKey: null, selfieMime: null, selfieProvider: null }
      });
      cleared++;
    }
  } finally {
    await tenant.$disconnect();
  }

  return { schoolId: school.schoolId, cleared, failed };
}

async function main() {
  const cutoff = cutoffDate();
  console.log(
    `${dryRun ? "[dry run] " : ""}Purging punch selfies from before ${cutoff.toISOString().slice(0, 10)} ` +
    `(${days}-day retention)`
  );

  const master = new MasterClient();
  let total = 0;

  try {
    const schools = await master.school.findMany({
      where: { isActive: true },
      select: { schoolId: true, dbUrl: true }
    });

    for (const school of schools) {
      try {
        const result = await purgeTenant(school, cutoff);
        if (result.skipped) {
          console.log(`  ${result.schoolId}: skipped (${result.skipped})`);
          continue;
        }
        if (result.cleared) {
          console.log(`  ${result.schoolId}: ${result.cleared} cleared${result.failed ? `, ${result.failed} file(s) missing` : ""}`);
        }
        total += result.cleared;
      } catch (error) {
        // One unreachable tenant must not stop the rest.
        console.error(`  ${school.schoolId}: FAILED — ${error?.message ?? error}`);
      }
    }
  } finally {
    await master.$disconnect();
  }

  console.log(`${dryRun ? "[dry run] " : ""}Done. ${total} selfie(s) ${dryRun ? "would be" : ""} cleared.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
