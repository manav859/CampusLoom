import type { NextFunction, Request, Response } from "express";
import { AppError } from "../core/errors.js";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit({ windowMs, max, keyPrefix }: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      throw new AppError(429, "Too many requests. Please try again later.", "RATE_LIMITED");
    }

    next();
  };
}
