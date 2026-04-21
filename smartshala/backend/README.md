# SmartShala Backend

Express + Prisma REST API for the SmartShala Day 1 foundation.

## Run Locally

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name day1_foundation
npm run seed
npm run dev
```

API roots: `http://localhost:4000/api` and `http://localhost:4000/api/v1`

Seed users:

- Principal: `principal@smartshala.local` / `SmartShala@123`
- Admin: `admin@smartshala.local` / `SmartShala@123`
- Teacher: `anita@smartshala.local` / `SmartShala@123`

## Architecture

- `routes` only wires HTTP paths.
- `controllers` translate HTTP requests/responses.
- `services` own business rules and Prisma access.
- `middleware` handles auth, RBAC, validation, logging, 404, and errors.
- `prisma/schema.prisma` is the source of truth for PostgreSQL relations.

## Key Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/classes`
- `GET /api/students`
