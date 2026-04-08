# Backend Changelog

## Step 1 - System Foundation Establishment

**Date:** 2026-04-07

**What was added:**
- Complete feature-based vertical sliced folder architecture.
- Bootstrapped Fastify application spanning plugins, configuration, utilities, and generic route mapping.
- **Migrated backend infrastructure from PostgreSQL/Prisma completely entirely to MongoDB/Mongoose (enforcing rigid NoSQL document modeling)**.
- Integrated Zod for strict deterministic environment checking.
- Pino logging functionality (JSON strings in Prod, beautiful logs locally).
- Global API envelope middleware guaranteeing responses adhere to `{ success: boolean, data/message/errors }`.

**What changed (Frontend impact):**
- **New Route**: `/api/v1/health` is now LIVE. You can ping this to verify successful communication from frontend.
- API is running natively strictly at root `/api/v1/` allowing version protection against `/api/v2/`.

**Breaking changes:**
- None; Initial push.

**Schema changes:**
- Scaffolded an absolute minimal model (`School`) specifically to allow generate mechanics until Phase 2 formal mapping executes.

## Step 3 - Pages CMS

**Date:** 2026-04-08

**What was added:**
- Full Pages CMS module with controller, service, schema, and route separation.
- Admin CRUD routes for pages under `/api/v1/pages`.
- Public published-page lookup by slug under `/api/v1/public/pages/:slug`.
- Flexible JSON page content storage with SEO metadata support.
- Centralized slug sanitization and uniqueness generation.
- Corrected auth controller responses to use the shared `{ success, data/message }` envelope and current Zod error shape.
- Added `backend/prisma/schema.prisma` containing the requested `Page` model contract.

**What changed (Frontend impact):**
- Frontend can now fetch published CMS content by slug without authentication.
- Admin panel can manage draft and published pages through protected APIs.

**Breaking changes:**
- Auth endpoints now consistently return the standard response envelope.

**Schema changes:**
- New MongoDB `Page` collection with unique `slug` and indexed `status`.
