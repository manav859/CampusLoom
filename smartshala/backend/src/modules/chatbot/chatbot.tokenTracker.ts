import { Redis } from "ioredis";
import { env } from "../../config/env.js";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on("error", (err: any) => {
      console.error("[chatbot.tokenTracker] Redis error — falling back to in-memory:", err?.message || err);
      redis = null;
    });
  }
  return redis;
}

// In-memory fallback (dev / Redis unavailable). Mirrors the daily/monthly keys
// with an expiry timestamp so usage resets the same way Redis TTLs would.
const memBuckets = new Map<string, { tokens: number; resetAt: number }>();

function memGet(key: string): number {
  const bucket = memBuckets.get(key);
  if (!bucket || bucket.resetAt < Date.now()) return 0;
  return bucket.tokens;
}

function memIncr(key: string, amount: number, resetAt: number): void {
  const bucket = memBuckets.get(key);
  if (!bucket || bucket.resetAt < Date.now()) {
    memBuckets.set(key, { tokens: amount, resetAt });
  } else {
    bucket.tokens += amount;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dailyKey(userId: string): string {
  const d = new Date();
  return `chat:daily:${userId}:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthlyKey(schoolId: string): string {
  const d = new Date();
  return `chat:monthly:${schoolId}:${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function secondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
}

function secondsUntilEndOfMonth(): number {
  const now = new Date();
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((startOfNextMonth.getTime() - now.getTime()) / 1000));
}

// Per-minute message limits by role. Slows usage to stay within the AI
// provider's free-tier rate limits and prevents one user spamming the bot.
const PER_MINUTE_LIMIT: Record<string, number> = { PRINCIPAL: 6, ADMIN: 6, TEACHER: 3 };

function perMinuteLimit(role: string): number {
  return PER_MINUTE_LIMIT[role] ?? 3;
}

/**
 * Returns true if the user is still under their per-minute message limit, and
 * counts this attempt. Fails open if the counter store is unavailable.
 */
async function withinRateLimit(userId: string, role: string): Promise<boolean> {
  const limit = perMinuteLimit(role);
  const key = `chat:rate:${userId}:${Math.floor(Date.now() / 60_000)}`;

  try {
    const r = getRedis();
    let count: number;
    if (r) {
      count = await r.incr(key);
      if (count === 1) await r.expire(key, 60);
    } else {
      memIncr(key, 1, Date.now() + 60_000);
      count = memGet(key);
    }
    return count <= limit;
  } catch (err) {
    console.error("[chatbot.tokenTracker] withinRateLimit error — failing open:", err);
    return true;
  }
}

export async function checkLimits(
  userId: string,
  schoolId: string,
  role: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Per-minute message rate limit applies to every role.
  if (!(await withinRateLimit(userId, role))) {
    return {
      allowed: false,
      reason: "You're sending messages too quickly. Please wait a minute and try again."
    };
  }

  // Principals are exempt from the daily/monthly token caps below.
  if (role === "PRINCIPAL") return { allowed: true };

  try {
    const dKey = dailyKey(userId);
    const mKey = monthlyKey(schoolId);
    const r = getRedis();

    let dailyUsed: number;
    let monthlyUsed: number;

    if (r) {
      const [d, m] = await Promise.all([r.get(dKey), r.get(mKey)]);
      dailyUsed = Number(d ?? 0);
      monthlyUsed = Number(m ?? 0);
    } else {
      dailyUsed = memGet(dKey);
      monthlyUsed = memGet(mKey);
    }

    if (dailyUsed >= env.CHAT_DAILY_TOKEN_LIMIT) {
      return { allowed: false, reason: "daily_limit" };
    }
    if (monthlyUsed >= env.CHAT_MONTHLY_SCHOOL_LIMIT) {
      return { allowed: false, reason: "monthly_limit" };
    }

    return { allowed: true };
  } catch (err) {
    // Fail open — never block a user because the usage store is unavailable.
    console.error("[chatbot.tokenTracker] checkLimits error — failing open:", err);
    return { allowed: true };
  }
}

export async function recordUsage(
  userId: string,
  schoolId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const total = (inputTokens || 0) + (outputTokens || 0);
  if (total <= 0) return;

  try {
    const dKey = dailyKey(userId);
    const mKey = monthlyKey(schoolId);
    const dailyTtl = secondsUntilMidnight();
    const monthlyTtl = secondsUntilEndOfMonth();
    const r = getRedis();

    if (r) {
      // TTLs are anchored to midnight / month-end, so re-setting them on every
      // increment is idempotent and keeps the key expiring at the right moment.
      await r.incrby(dKey, total);
      await r.expire(dKey, dailyTtl);
      await r.incrby(mKey, total);
      await r.expire(mKey, monthlyTtl);
    } else {
      memIncr(dKey, total, Date.now() + dailyTtl * 1000);
      memIncr(mKey, total, Date.now() + monthlyTtl * 1000);
    }
  } catch (err) {
    // Usage accounting must never break a successful chat response.
    console.error("[chatbot.tokenTracker] recordUsage error (ignored):", err);
  }
}
