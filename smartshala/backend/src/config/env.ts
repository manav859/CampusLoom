import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    return value;
  },
  z.boolean()
);

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
  CONNECT_DATABASE_ON_BOOT: booleanFromEnv.default(false),
  DB_WARMUP_ENABLED: booleanFromEnv.default(false),
  BACKGROUND_WORKERS_ENABLED: booleanFromEnv.default(false),
  DEMO_RESET_ENABLED: z
    .preprocess((value) => value === "true" || value === true, z.boolean())
    .default(false),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  AI_PROVIDER: z.enum(["anthropic", "gemini", "openrouter"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CLAUDE_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().default("google/gemma-4-31b-it:free"),
  CHAT_DAILY_TOKEN_LIMIT: z.coerce.number().default(5000),
  CHAT_MONTHLY_SCHOOL_LIMIT: z.coerce.number().default(600000),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("ap-south-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(), // for S3-compatible (Cloudflare R2, MinIO)
  S3_KEY_PREFIX: z.string().default("student-documents"),
  // Billing / Razorpay. "mock" runs the bundled fake gateway end to end; "live"
  // talks to api.razorpay.com and requires real keys.
  RAZORPAY_MODE: z.enum(["mock", "live"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().default("rzp_test_mock0000000000"),
  RAZORPAY_KEY_SECRET: z.string().default("mock_key_secret_change_me"),
  RAZORPAY_WEBHOOK_SECRET: z.string().default("mock_webhook_secret_change_me"),
  BILLING_CURRENCY: z.string().default("INR"),
  BILLING_TAX_PERCENT: z.coerce.number().min(0).max(100).default(18),
  BILLING_GRACE_DAYS: z.coerce.number().int().min(0).max(90).default(7),
  BILLING_INVOICE_DUE_DAYS: z.coerce.number().int().min(0).max(90).default(7),
  BILLING_RENEWAL_LEAD_DAYS: z.coerce.number().int().min(0).max(90).default(7),
  // Who the invoice document is issued by. Left blank rather than guessed, so a
  // wrong address never goes out on a document a school files.
  BILLING_SELLER_NAME: z.string().default("SmartShala"),
  BILLING_SELLER_ADDRESS: z.string().optional(),
  BILLING_SUPPORT_EMAIL: z.string().optional(),
  // GST identity of the seller. The state code is what decides whether an
  // invoice carries CGST+SGST or IGST, so it has no sensible default.
  BILLING_SELLER_GSTIN: z.string().optional(),
  BILLING_SELLER_PAN: z.string().optional(),
  BILLING_SELLER_STATE: z.string().optional(),
  BILLING_SELLER_STATE_CODE: z.string().regex(/^\d{2}$/).optional(),
  BILLING_SELLER_PHONE: z.string().optional(),
  // SAC 998434 — "on-line software services". Override if your CA says otherwise.
  BILLING_SAC_CODE: z.string().default("998434"),
  // How long a shareable payment link stays usable.
  BILLING_PAYMENT_LINK_DAYS: z.coerce.number().int().min(1).max(90).default(14)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
