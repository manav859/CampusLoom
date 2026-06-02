import "dotenv/config";
import { spawn } from "node:child_process";
import { PrismaClient } from "../node_modules/@smartshala/master-client/index.js";

// Applies pending Prisma migrations to every active tenant database.
//
// render-start.mjs only migrates the master DB and the main DATABASE_URL. Each
// school has its own tenant database that is migrated at creation time only, so
// migrations added afterwards never reach existing tenants. That drift makes
// queries select columns that do not exist in older tenants and crash with 500s
// (e.g. the login `include: { school: true }`). Run this after adding migrations.

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, env) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => resolve({ code: 1, output: String(error.stack ?? error.message ?? error) }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

async function migrateTenant(school) {
  const dbUrl = school.dbUrl;
  const directUrl = school.directDbUrl ?? school.dbUrl;
  if (!dbUrl) {
    return { schoolId: school.schoolId, code: 1, output: "missing dbUrl" };
  }

  const result = await run(NPX, ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    ...process.env,
    DATABASE_URL: dbUrl,
    DIRECT_URL: directUrl,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK ?? "1"
  });
  return { schoolId: school.schoolId, ...result };
}

async function main() {
  if (!process.env.MASTER_DATABASE_URL) {
    console.error("MASTER_DATABASE_URL is not set — no tenant databases to migrate.");
    process.exit(1);
  }

  const master = new PrismaClient();
  let failures = 0;
  try {
    const schools = await master.school.findMany({
      where: { isActive: true },
      select: { schoolId: true, dbUrl: true, directDbUrl: true }
    });

    console.log(`Migrating ${schools.length} active tenant database(s)...`);

    // Sequential so logs stay readable and we do not open too many tenant connections at once.
    for (const school of schools) {
      console.log(`\n--- Tenant ${school.schoolId} ---`);
      const result = await migrateTenant(school);
      process.stdout.write(result.output);
      if (result.code === 0) {
        console.log(`OK: ${school.schoolId}`);
      } else {
        failures += 1;
        console.error(`FAILED: ${school.schoolId} (exit ${result.code})`);
      }
    }
  } finally {
    await master.$disconnect();
  }

  console.log(`\nDone. ${failures} tenant(s) failed.`);
  process.exit(failures > 0 ? 1 : 0);
}

await main();
