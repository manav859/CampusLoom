#!/usr/bin/env node
/**
 * Smart Shala — Master DB backup script
 * 
 * Dumps the master database to a timestamped SQL file and 
 * optionally uploads it to S3-compatible storage.
 * 
 * Usage:
 *   node scripts/backup-master-db.mjs
 * 
 * Required env vars:
 *   MASTER_DATABASE_URL      Neon direct connection string
 *   BACKUP_S3_BUCKET         (optional) S3 bucket name
 *   BACKUP_S3_PREFIX         (optional) key prefix, e.g. "backups/master"
 *   AWS_ACCESS_KEY_ID        (optional) for S3 upload
 *   AWS_SECRET_ACCESS_KEY    (optional) for S3 upload
 *   AWS_REGION               (optional) default: ap-south-1
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MASTER_URL  = process.env.MASTER_DATABASE_URL;
const S3_BUCKET   = process.env.BACKUP_S3_BUCKET;
const S3_PREFIX   = process.env.BACKUP_S3_PREFIX ?? "backups/master-db";
const AWS_REGION  = process.env.AWS_REGION ?? "ap-south-1";

if (!MASTER_URL) {
  console.error("ERROR: MASTER_DATABASE_URL is not set");
  process.exit(1);
}

// ── 1. Create output directory ────────────────────────────────
const outDir = join(process.cwd(), "tmp-backups");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ── 2. Generate timestamped filename ─────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const filename = `master-db-${ts}.sql`;
const filepath = join(outDir, filename);

// ── 3. Run pg_dump ────────────────────────────────────────────
console.log(`[backup] Dumping master DB → ${filepath}`);

const result = spawnSync(
  "pg_dump",
  ["--no-owner", "--no-acl", "--format=plain", `--dbname=${MASTER_URL}`, "--file", filepath],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
);

if (result.status !== 0) {
  console.error("[backup] pg_dump failed:\n", result.stderr);
  process.exit(1);
}

console.log(`[backup] Dump complete: ${filepath}`);

// ── 4. Upload to S3 (optional) ────────────────────────────────
if (S3_BUCKET) {
  const s3Key = `${S3_PREFIX}/${filename}`;
  console.log(`[backup] Uploading to s3://${S3_BUCKET}/${s3Key}`);
  
  try {
    execSync(
      `aws s3 cp "${filepath}" "s3://${S3_BUCKET}/${s3Key}" --region ${AWS_REGION}`,
      { stdio: "inherit" }
    );
    console.log("[backup] Upload complete.");
  } catch (err) {
    console.error("[backup] S3 upload failed:", err.message);
    process.exit(1);
  }
} else {
  console.log("[backup] BACKUP_S3_BUCKET not set — backup saved locally only.");
  console.log(`[backup] File: ${filepath}`);
}

console.log("[backup] Done.");
