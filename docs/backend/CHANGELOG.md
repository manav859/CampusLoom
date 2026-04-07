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
