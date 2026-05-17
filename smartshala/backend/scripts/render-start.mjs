import { spawn } from "node:child_process";

const MAX_MIGRATION_ATTEMPTS = 5;
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const RETRYABLE_MIGRATION_PATTERNS = [
  "P1002",
  "advisory lock",
  "Timed out trying to acquire a postgres advisory lock"
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn(command, args, {
      ...options,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => resolve({ code: code ?? 1, output }));
    child.on("error", (error) => {
      const text = String(error.stack ?? error.message ?? error);
      process.stderr.write(`${text}\n`);
      resolve({ code: 1, output: text });
    });
  });
}

function isRetryableMigrationError(output) {
  return RETRYABLE_MIGRATION_PATTERNS.some((pattern) => output.toLowerCase().includes(pattern.toLowerCase()));
}

async function deployMigrations() {
  const env = {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK ?? "1"
  };

  for (let attempt = 1; attempt <= MAX_MIGRATION_ATTEMPTS; attempt += 1) {
    console.log(`Running Prisma migrations (${attempt}/${MAX_MIGRATION_ATTEMPTS})...`);
    const result = await run(NPX, ["prisma", "migrate", "deploy"], { env });
    if (result.code === 0) return;

    if (attempt === MAX_MIGRATION_ATTEMPTS || !isRetryableMigrationError(result.output)) {
      process.exit(result.code);
    }

    const delayMs = 3000 * attempt;
    console.warn(`Prisma migration lock timeout. Retrying in ${delayMs / 1000}s...`);
    await wait(delayMs);
  }
}

async function deployMasterMigrations() {
  if (!process.env.MASTER_DATABASE_URL) return;

  console.log("Running Prisma master migrations...");
  const result = await run(NPX, ["prisma", "migrate", "deploy", "--schema", "prisma/master/schema.prisma"], {
    env: process.env
  });

  if (result.code !== 0) {
    process.exit(result.code);
  }
}

await deployMasterMigrations();
await deployMigrations();
const server = await run("node", ["dist/server.js"], { stdio: "inherit" });
process.exit(server.code);
