# Backup & Restore Procedure

> ⚠️ **NOT FORMALLY DOCUMENTED** — No explicit backup/restore scripts exist in the codebase.

**Current state**:
- Neon PostgreSQL provides point-in-time recovery (PITR) at the infrastructure level.
- The `render-start.mjs` script handles migration deployment with retries.
- Tenant deletion has a 3-day cancellation window before databases are dropped via Neon API.

**Recommended actions for production**:
- Configure Neon's automated backups and retention policy.
- Create a `pg_dump` / `pg_restore` script for manual backups.
- Document the RTO/RPO requirements.
