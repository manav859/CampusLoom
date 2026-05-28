# Caching Strategy Details

- **Backend**: No Redis cache or in-memory cache layer
- **Frontend**: 
  - `prefetchCache.ts` — client-side data prefetching with TTL-based cache
  - API calls use `cache: "no-store"` (no browser caching)
  - GET requests have automatic retry with exponential backoff (max 2 retries)
- **Database**: Neon connection pooling via pgbouncer

> ⚠️ **No server-side caching is implemented.** For production scale, consider Redis for: session data, dashboard KPIs, frequently accessed class/student lists.
