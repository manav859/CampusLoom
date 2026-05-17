# Multi-Tenant Onboarding Architecture

SmartShala now has the foundation for path-based multi-tenancy:

- Frontend tenant routes use `/:schoolId/...`.
- Backend tenant API routes use `/:schoolId/api/...`.
- Existing `/api/...` and existing frontend routes remain available for backward compatibility.
- A master database stores school onboarding, payment, coupon, trial, and tenant database metadata.
- Each school database remains isolated and uses the existing ERP Prisma schema.

## Databases

Use one Neon project with many databases:

```text
master_db
school_AB12CD34
school_XYZ91KLM
```

The master schema lives at:

```text
backend/prisma/master/schema.prisma
```

Apply master migrations:

```bash
npm run prisma:migrate:master
```

## Render Environment

Required for onboarding:

```env
MASTER_DATABASE_URL=postgresql://.../master_db?sslmode=require
NEON_API_KEY=...
NEON_PROJECT_ID=...
NEON_BRANCH_ID=...
NEON_ROLE_NAME=...
NEON_DATABASE_URL_TEMPLATE=postgresql://USER:PASSWORD@HOST/{database}?sslmode=require&channel_binding=require
NEON_DIRECT_URL_TEMPLATE=postgresql://USER:PASSWORD@DIRECT_HOST/{database}?sslmode=require
```

The Render start script deploys master migrations when `MASTER_DATABASE_URL`
exists, then deploys the existing ERP tenant schema.

## Tenant Resolution

`tenantMiddleware` validates the public 8-character school ID, reads the school
record from the master DB, blocks inactive or expired schools, then places a
tenant Prisma client into AsyncLocalStorage.

Existing services still import `prisma` from `src/core/prisma.ts`. That export
now proxies to the tenant Prisma client when the request is under
`/:schoolId/api`.

## Onboarding

Public route:

```text
POST /api/onboarding
GET /api/onboarding/coupon-preview?code=...
```

The onboarding flow:

1. Validates school and owner input.
2. Generates a cryptographically random 8-character school ID.
3. Creates a Neon database named `school_<schoolId>`.
4. Runs tenant Prisma migrations.
5. Seeds the first principal account.
6. Stores database metadata in the master DB.
7. Returns the tenant login path.

Payment is simulated until Razorpay is added.

## Frontend

Public onboarding page:

```text
/onboard
```

Tenant login:

```text
/:schoolId/login
```

Tenant workspace paths:

```text
/:schoolId/dashboard
/:schoolId/students
/:schoolId/teachers
```

Next middleware rewrites tenant workspace paths to the existing page tree while
preserving the tenant URL in the browser.

## Existing School Migration

Recommended production-safe path:

1. Create a master `School` row for the existing school.
2. Create a tenant DB named `school_<generatedSchoolId>`.
3. Run `prisma migrate deploy` against that tenant DB.
4. Copy current ERP data from the default DB to the tenant DB with `pg_dump` /
   `pg_restore` or a controlled Prisma copy script.
5. Verify login through `/:schoolId/login`.
6. Keep legacy `/api` active until production traffic is switched.

Do not delete the current production database during migration.

Temporary compatibility registration is available when the current ERP database
should be treated as one tenant before a physical copy is performed:

```bash
EXISTING_SCHOOL_ID=AB12CD34 npm run tenant:register-existing
```
