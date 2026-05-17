# Neon PostgreSQL Migration Notes

SmartShala now uses Neon PostgreSQL permanently. Application traffic should use
Neon's pooled connection string, while Prisma migration/schema commands should
use the direct connection string.

## Environment Variables

Set these in `backend/.env` for local development and in Render service
environment variables for production:

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-example-pooler.c-7.us-east-1.aws.neon.tech/smartshala?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-example.c-7.us-east-1.aws.neon.tech/smartshala?sslmode=require"
```

Rules:

- `DATABASE_URL` uses the Neon pooled host containing `-pooler`.
- `DIRECT_URL` uses the same host without `-pooler`.
- Keep `sslmode=require`.
- Keep secrets only in `.env`, Render, or Neon. Do not hardcode them in source.

## Migration Commands

Run from `backend/`:

```powershell
npm run prisma:generate
npx prisma migrate status
npx prisma db pull
npm run build
```

For production deploys, the existing Render start script runs:

```powershell
npx prisma migrate deploy
node dist/server.js
```

## Safe Baseline Recovery

Use this only if the Neon database already has the expected tables but Prisma
migration history is missing or broken:

1. Confirm the live schema first:
   ```powershell
   npx prisma db pull
   ```
2. Check migration state:
   ```powershell
   npx prisma migrate status
   ```
3. Mark already-applied migrations as applied, oldest to newest:
   ```powershell
   npx prisma migrate resolve --applied MIGRATION_FOLDER_NAME
   ```
4. Re-run:
   ```powershell
   npx prisma migrate status
   ```

Do not run destructive reset commands on production.

## Health Check

Database connectivity is available at:

- `GET /health/db`
- `GET /api/health/db`
- `GET /api/v1/health/db`

Success response:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-05-17T00:00:00.000Z"
}
```

Failure returns HTTP `503` with a safe error name.

## Render Deployment Checklist

1. Open the Render backend service.
2. Replace the old Render PostgreSQL `DATABASE_URL` with the Neon pooled URL.
3. Add `DIRECT_URL` with the Neon direct URL.
4. Remove old Render PostgreSQL references from environment variables.
5. Keep existing JWT, CORS, WhatsApp, and Redis settings unchanged.
6. Confirm build/start commands still match `backend/package.json`.
7. Trigger GitHub auto deploy.
8. After deploy, check logs for `Running Prisma migrations` and
   `SmartShala API listening`.
9. Call `/health/db`.

## Validation Checklist

- `npm run prisma:generate`
- `npx prisma migrate status`
- `npx prisma db pull`
- `npm run build`
- Login APIs
- Student/class/attendance/fees CRUD flows
- Dashboard and analytics Prisma queries
- Production deploy logs
- `/health/db` returns `status: ok`

## Troubleshooting

- `P1001` or `P1002`: verify Neon host, password, SSL mode, and that the branch
  is active.
- DNS lookup fails only for the Neon endpoint: copy a fresh pooled and direct
  connection string from the Neon dashboard for the active branch.
- `P2024`: pooled connections are exhausted; reduce concurrency or review Neon
  pool limits.
- Migration lock timeout: keep `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1`; the
  Render start script already retries migration deploy.
- `Environment variable not found: DIRECT_URL`: add `DIRECT_URL` anywhere Prisma
  commands run, including Render.
- Auth succeeds locally but fails on Render: check Render has the current JWT
  secrets and CORS frontend URL.
- `db pull` shows unexpected model changes: do not apply a migration blindly;
  compare against `prisma/schema.prisma` and resolve drift intentionally.

## Future Tenant Preparation

Prisma is isolated behind `backend/src/lib/prisma.ts`. Existing modules can
continue importing from `src/core/prisma.ts`, which re-exports the same client
for backward compatibility. Future multi-tenant work should add tenant-aware
repository or service boundaries around this single database entrypoint rather
than scattering Prisma client construction across feature modules.
