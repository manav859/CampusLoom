# SmartShala Backend

Express + Prisma REST API for SmartShala V1.

## Run Locally

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

API root: `http://localhost:4000/api/v1`

Seed users:

- Admin: `principal@smartshala.local` / `SmartShala@123`
- Teacher: `anita@smartshala.local` / `SmartShala@123`

## Architecture

- `routes` only wires HTTP paths.
- `controllers` translate HTTP requests/responses.
- `services` own business rules and Prisma access.
- `middleware` handles auth, RBAC, validation, logging, 404, and errors.
- `prisma/schema.prisma` is the source of truth for PostgreSQL relations.

## Key Endpoints

- `POST /api/v1/auth/login`
- `GET /api/v1/dashboard`
- `GET /api/v1/classes`
- `GET /api/v1/students`
- `GET /api/v1/attendance/roster?classId=...`
- `POST /api/v1/attendance/mark`
- `GET /api/v1/fees/dashboard`
- `POST /api/v1/fees/payments`
- `GET /api/v1/analytics/risk-summary`
- `GET /api/v1/reports/daily-principal`
- `GET /api/v1/notifications`

