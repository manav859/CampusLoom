import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  MASTER_DATABASE_URL: z.string().url().optional(),
  NEON_API_KEY: z.string().optional(),
  NEON_PROJECT_ID: z.string().optional(),
  NEON_BRANCH_ID: z.string().optional(),
  NEON_ROLE_NAME: z.string().optional(),
  NEON_DATABASE_URL_TEMPLATE: z.string().optional(),
  NEON_DIRECT_URL_TEMPLATE: z.string().optional(),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  SUPER_ADMIN_PASSWORD_HASH: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z
    .preprocess((value) => value === undefined ? undefined : !(value === "false" || value === false), z.boolean())
    .default(true),
  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.string().default("info"),
  PRISMA_LOG_LEVEL: z.string().default("error,warn"),
  DEMO_RESET_ENABLED: z
    .preprocess((value) => value === "true" || value === true, z.boolean())
    .default(false),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  AI_PROVIDER: z.enum(["anthropic", "gemini"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CLAUDE_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  CHAT_DAILY_TOKEN_LIMIT: z.coerce.number().default(5000),
  CHAT_MONTHLY_SCHOOL_LIMIT: z.coerce.number().default(600000),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("ap-south-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(), // for S3-compatible (Cloudflare R2, MinIO)
  S3_KEY_PREFIX: z.string().default("student-documents")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
