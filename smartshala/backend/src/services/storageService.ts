import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "../config/env.js";

// ── S3 client (lazy init) ────────────────────────────────────
let s3: S3Client | null = null;

function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
      ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_KEY
        ? {
            credentials: {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_KEY,
            },
          }
        : {}),
    });
  }
  return s3;
}

const isS3Enabled = (): boolean => Boolean(env.S3_BUCKET);

// Resolve an S3-style key (forward slashes) to a local filesystem path
// under uploads/. Used by the dev-only local disk fallback.
function localPathForKey(key: string): string {
  return join(process.cwd(), "uploads", ...key.split("/"));
}

// ── Upload ───────────────────────────────────────────────────
export async function uploadFile(params: {
  buffer: Buffer;
  key: string;         // e.g. "student-documents/SCHOOL_ID/STUDENT_ID/uuid-filename.pdf"
  mimeType: string;
  originalName: string;
}): Promise<{ storageKey: string; storageProvider: "s3" | "local" }> {
  if (isS3Enabled()) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.mimeType,
        ContentDisposition: `attachment; filename="${params.originalName}"`,
        // Private by default — no ACL needed for private buckets
        ServerSideEncryption: "AES256",
      })
    );
    return { storageKey: params.key, storageProvider: "s3" };
  }

  // Local disk fallback (dev only)
  const localPath = localPathForKey(params.key);
  const dir = dirname(localPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await writeFile(localPath, params.buffer);
  return { storageKey: params.key, storageProvider: "local" };
}

// ── Generate presigned download URL (S3) or local path ───────
export async function getDownloadUrl(storageKey: string): Promise<string> {
  if (isS3Enabled()) {
    const url = await getSignedUrl(
      getS3(),
      new GetObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: storageKey,
      }),
      { expiresIn: 15 * 60 }  // 15 minutes
    );
    return url;
  }
  // Local fallback — return the key (caller serves the file)
  return storageKey;
}

// ── Delete ───────────────────────────────────────────────────
export async function deleteFile(storageKey: string): Promise<void> {
  if (isS3Enabled()) {
    await getS3().send(
      new DeleteObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: storageKey,
      })
    );
    return;
  }
  // Local fallback
  const localPath = localPathForKey(storageKey);
  if (existsSync(localPath)) unlinkSync(localPath);
}
