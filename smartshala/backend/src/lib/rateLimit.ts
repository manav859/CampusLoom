import type { Request, Response, NextFunction } from "express";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

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
      console.error("[rateLimit] Redis error — falling back to in-memory:", err?.message || err);
      redis = null;
    });
  }
  return redis;
}

// In-memory fallback (dev / Redis unavailable)
const memBuckets = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyFn?: (req: Request) => string;
  message?: string;
}

export function rateLimit(opts: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
    const customKey = opts.keyFn ? opts.keyFn(req) : ip;
    const key = `rl:${opts.keyPrefix}:${customKey}`;

    try {
      const r = getRedis();
      if (r) {
        // Redis sliding-window with INCR + EXPIRE
        const count = await r.incr(key);
        if (count === 1) {
          await r.pexpire(key, opts.windowMs);
        }
        const ttl = await r.pttl(key);
        res.setHeader("X-RateLimit-Limit", opts.max);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, opts.max - count));
        res.setHeader("X-RateLimit-Reset", Math.ceil(Date.now() / 1000 + ttl / 1000));
        if (count > opts.max) {
          res.status(429).json({
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: opts.message ?? "Too many requests. Please try again later.",
            },
          });
          return;
        }
      } else {
        // In-memory fallback
        const now = Date.now();
        let bucket = memBuckets.get(key);
        if (!bucket || bucket.resetAt < now) {
          bucket = { count: 0, resetAt: now + opts.windowMs };
          memBuckets.set(key, bucket);
        }
        bucket.count++;
        if (bucket.count > opts.max) {
          res.status(429).json({
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: opts.message ?? "Too many requests. Please try again later.",
            },
          });
          return;
        }
      }
    } catch (err) {
      // Never block a request if rate limiter errors — fail open and log
      console.error("[rateLimit] Error:", err);
    }

    next();
  };
}
