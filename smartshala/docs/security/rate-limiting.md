# Rate Limiting & Brute Force Protection

- **Implementation**: Custom in-memory rate limiter (`middleware/rateLimit.ts`)
- **Storage**: In-memory `Map<string, Bucket>` (not persistent, not distributed)
- **Key**: `{keyPrefix}:{req.ip}` — per-IP rate limiting
- **Configurable**: `windowMs` (time window) and `max` (max requests)
- **Applied to**: Auth login routes (prevents brute force)
- **Response**: HTTP 429 with error code `RATE_LIMITED`

> ⚠️ **Limitation**: In-memory only. Not shared across horizontally scaled instances. For production at scale, migrate to Redis-backed rate limiter.
