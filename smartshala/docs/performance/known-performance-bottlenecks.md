# Known Performance Bottlenecks

| # | Bottleneck | Mitigation Applied |
|---|-----------|-------------------|
| 1 | **Bulk marks entry** — per-student upsert caused Prisma transaction timeout | ✅ Fixed: Replaced with bulk insert transaction |
| 2 | **Attendance submission** — per-student upsert timeout on remote Postgres | ✅ Fixed: Replaced with bulk delete/create writes |
| 3 | **Neon cold starts** — first request after idle fails | ✅ Fixed: DB warmup middleware with scheduled pings |
| 4 | **Prisma migration locks** — advisory lock timeout on Render | ✅ Fixed: `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` + retry logic |
| 5 | **Large student detail query** — single endpoint returns 7 tabs of data | ⚠️ Partially mitigated with conditional joins based on role |
| 6 | **No connection pooling management** — relies on Neon's built-in pgbouncer | ⚠️ Acceptable for current scale |
