# SmartShala

SmartShala is a production-style school ERP foundation for Indian schools. Day 1 sets up the full-stack project structure, PostgreSQL schema, Prisma ORM, JWT authentication, role-based access, seed data, and a protected dashboard shell.

## Stack

- Frontend: Next.js, React, Tailwind CSS.
- Backend: Node.js, Express.js.
- Database: PostgreSQL.
- ORM: Prisma.
- Auth: JWT access tokens with refresh token scaffold.
- API: REST.

## Repo Structure

```txt
smartshala/
  backend/
    prisma/
    src/
      config/
      core/
      middleware/
      modules/
      routes/
      jobs/
    tests/
  frontend/
    src/
      app/
      components/
      features/
      lib/
      types/
  docs/
```

## Run Locally

```bash
cd smartshala/backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

```bash
cd smartshala/frontend
npm install
cp .env.example .env.local
npm run dev
```

Backend: `http://localhost:4000/api/v1`

Frontend: `http://localhost:3000`

## Day 1 Scope

- Principal, admin, and teacher roles.
- `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`.
- Protected frontend routes with session hydration from the API.
- Core database models for users, classes, and students, with scaffolded relations for future ERP modules.
- Seed data: 1 principal, 1 admin, 2 teachers, 2 classes, and 20 students.
