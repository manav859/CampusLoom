# Common Issues & Fix Guide

| Issue | Cause | Fix |
|-------|-------|-----|
| "Something went wrong" on first request after cold start | Neon DB wakes from sleep | Wait 2-3 seconds; DB warmup middleware auto-retries |
| `P1001` / `P1002` errors | Neon connection issue | Verify DATABASE_URL, check Neon branch is active |
| `P2024` pool exhausted | Too many concurrent connections | Reduce concurrency or increase Neon pool limits |
| Migration lock timeout | Advisory lock contention | Set `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` |
| Login works locally but fails on Render | JWT secrets or CORS mismatch | Ensure Render has same JWT secrets and FRONTEND_URL |
| Attendance submission timeout | Bulk upsert on remote Postgres | Already fixed — uses bulk delete/create |
| Marks saving timeout | Per-student upsert transaction | Already fixed — uses bulk insert |
| Tenant 404 "School not found" | Invalid school ID format | School IDs must be 8-character alphanumeric uppercase |
