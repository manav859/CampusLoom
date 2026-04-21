# System Overview

SmartShala uses a separate frontend and backend.

## Stack

- Frontend: Next.js, React, Tailwind CSS.
- Backend: Node.js, Express.js, Prisma.
- Database: PostgreSQL.
- Auth: JWT access tokens with refresh token persistence.
- API style: REST.
- Notifications: WhatsApp service abstraction, queue-ready for Redis/BullMQ.

## Backend Layers

- Routes: HTTP path registration only.
- Controllers: request/response translation.
- Services: business rules and Prisma queries.
- Middleware: auth, role checks, validation, logging, 404, and errors.
- Prisma: schema, migrations, and seed data.

## Guardrails

- Every business table carries `schoolId`.
- Teachers only see assigned classes.
- Admins manage school-wide data.
- Parents have no login in V1.
- Route handlers must not own business logic.
- Validate input at request boundary with Zod.
- Use Prisma for database access; avoid raw SQL unless justified.
- Do not hardcode secrets.

