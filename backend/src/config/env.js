import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment variable schema.
 * The app will fail fast if any required variable is missing or invalid.
 */
const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform(Number)
    .pipe(z.number().int().positive()),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  DATABASE_URL: z
    .string()
    .url()
    .refine((val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'), {
      message: 'DATABASE_URL must be a valid MongoDB connection string',
    }),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),

  CORS_ORIGIN: z
    .string()
    .min(1, 'CORS_ORIGIN is required'),
});

/**
 * Parse and validate environment variables.
 * Throws a descriptive error and exits if validation fails.
 *
 * @returns {z.infer<typeof envSchema>} Validated env config
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error('❌ Invalid environment variables:\n' + formatted);
    process.exit(1);
  }

  return Object.freeze(result.data);
}

/** Singleton config — initialised once at startup */
let _config;

export function getConfig() {
  if (!_config) {
    _config = validateEnv();
  }
  return _config;
}
