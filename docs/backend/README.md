# SchoolOS Backend Documentation

Welcome to the **SchoolOS Backend** documentation. SchoolOS is a production-grade multi-tenant SaaS specifically built for school management.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Fastify
- **Database**: MongoDB
- **ODM**: Mongoose
- **Validation**: Zod
- **Logging**: Pino
- **Authentication**: JWT (Phase 2 implementation)

## Architecture Style
This backend follows a **vertical feature-based modular architecture**. We strictly avoid global `controllers/`, `services/`, and `routes/` folders. Instead, features have self-contained modules.

### Folder Structure
```
backend/
├── src/
│   ├── app.js               # Fastify app builder
│   ├── server.js            # Entry point & listener
│   ├── config/              # Environment handling (Zod validation)
│   ├── plugins/             # Fastify plugins (e.g. Prisma, Logger)
│   ├── middleware/          # Global middlewares (e.g. errorHandler)
│   ├── utils/               # Reusable pure functions (e.g. response wrappers)
│   ├── common/              # Shared constants (e.g. API prefix, Roles)
│   └── modules/             # [CORE] Feature modules
│       ├── auth/
│       ├── users/
│       └── ...
```

## Security Principles
- Strict environment validation at startup; app crashes immediately if misconfigured.
- Global error handler sanitizes stack traces from the client in production.
- CORS restricted to defined origins.
- Inputs must be strongly validated using Zod.
- All endpoints prefix under `/api/v1`.

## Local Setup
1. Copy `.env.example` to `.env` and fill in necessary details (e.g., your local MongoDB URL).
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Current Module Status

| Module      | Status                  | Notes                           |
| ----------- | ----------------------- | ------------------------------- |
| Health      | **Implemented**         | Returns uptime `/health`        |
| Auth        | Scaffolded / Planned    | Phase 2 target                  |
| Users       | Scaffolded / Planned    | Phase 2 target                  |
| Pages       | Scaffolded / Planned    |                                 |
| Media       | Scaffolded / Planned    | Cloudinary integration planned  |
| Notices     | Scaffolded / Planned    |                                 |
| Events      | Scaffolded / Planned    |                                 |
| Admissions  | Scaffolded / Planned    |                                 |
| Faculty     | Scaffolded / Planned    |                                 |
| Gallery     | Scaffolded / Planned    |                                 |
| Results     | Scaffolded / Planned    |                                 |
| Dashboard   | Scaffolded / Planned    |                                 |
| Audit Logs  | Scaffolded / Planned    |                                 |
| Settings    | Scaffolded / Planned    |                                 |
