# Local Development

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm

## Backend

```bash
cd smartshala/backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

Backend API: `http://localhost:4000/api/v1`

## Frontend

```bash
cd smartshala/frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend: `http://localhost:3000`

## Seed Accounts

- Admin: `principal@smartshala.local` / `SmartShala@123`
- Teacher: `anita@smartshala.local` / `SmartShala@123`

