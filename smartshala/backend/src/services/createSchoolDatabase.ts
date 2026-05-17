import { spawn } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

type CreateSchoolDatabaseInput = {
  schoolId: string;
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
  dbName: string;
  adminPassword: string;
};

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for Neon onboarding`);
  return value;
}

function databaseUrlFromTemplate(template: string | undefined, dbName: string, fallback?: string) {
  const source = template ?? fallback;
  if (!source) throw new Error("Database URL template is not configured");
  if (source.includes("{database}")) return source.replaceAll("{database}", dbName);

  const url = new URL(source);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function run(command: string, args: string[], runEnv: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: runEnv,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(output || `${command} exited with ${code}`));
    });
  });
}

async function createNeonDatabase(dbName: string) {
  const projectId = required(env.NEON_PROJECT_ID, "NEON_PROJECT_ID");
  const branchId = required(env.NEON_BRANCH_ID, "NEON_BRANCH_ID");
  const apiKey = required(env.NEON_API_KEY, "NEON_API_KEY");

  const body: { database: { name: string; owner_name?: string } } = {
    database: {
      name: dbName
    }
  };
  if (env.NEON_ROLE_NAME) body.database.owner_name = env.NEON_ROLE_NAME;

  const response = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches/${branchId}/databases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Neon database creation failed: ${response.status} ${await response.text()}`);
  }
}

async function migrateTenantDatabase(databaseUrl: string, directUrl: string) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  await run(npx, ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK ?? "1"
  });
}

async function seedInitialAdmin(input: CreateSchoolDatabaseInput, databaseUrl: string) {
  const tenantPrisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });

  try {
    const passwordHash = await bcrypt.hash(input.adminPassword, 10);
    const school = await tenantPrisma.school.upsert({
      where: { code: input.schoolId },
      update: {
        name: input.schoolName,
        phone: input.phone
      },
      create: {
        code: input.schoolId,
        name: input.schoolName,
        phone: input.phone
      }
    });

    await tenantPrisma.user.upsert({
      where: { schoolId_email: { schoolId: school.id, email: input.email } },
      update: {
        fullName: input.ownerName,
        phone: input.phone,
        passwordHash,
        role: UserRole.PRINCIPAL,
        status: UserStatus.ACTIVE,
        isActive: true
      },
      create: {
        schoolId: school.id,
        fullName: input.ownerName,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: UserRole.PRINCIPAL,
        status: UserStatus.ACTIVE,
        isActive: true
      }
    });
  } finally {
    await tenantPrisma.$disconnect();
  }
}

export async function createSchoolDatabase(input: CreateSchoolDatabaseInput) {
  const databaseUrl = databaseUrlFromTemplate(env.NEON_DATABASE_URL_TEMPLATE, input.dbName, env.DATABASE_URL);
  const directUrl = databaseUrlFromTemplate(env.NEON_DIRECT_URL_TEMPLATE, input.dbName, env.DIRECT_URL);

  logger.info({ schoolId: input.schoolId, dbName: input.dbName }, "Creating Neon tenant database");
  await createNeonDatabase(input.dbName);

  logger.info({ schoolId: input.schoolId, dbName: input.dbName }, "Running tenant migrations");
  await migrateTenantDatabase(databaseUrl, directUrl);

  logger.info({ schoolId: input.schoolId, dbName: input.dbName }, "Seeding tenant admin account");
  await seedInitialAdmin(input, databaseUrl);

  return {
    dbName: input.dbName,
    dbUrl: databaseUrl,
    directDbUrl: directUrl
  };
}
