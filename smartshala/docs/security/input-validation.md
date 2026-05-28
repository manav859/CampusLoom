# Input Validation & Sanitization Approach

- **Validation library**: Zod (^3.23.8) — used at the request boundary
- **Middleware**: `validate.ts` parses `req.body`, `req.query`, and `req.params` using Zod schemas
- **Schema files**: Each module has a `*.schemas.ts` file (e.g., `auth.schemas.ts`, `fees.schemas.ts`, `students.schemas.ts`)
- **Environment validation**: `config/env.ts` validates all env vars with Zod at startup
- **Error handling**: ZodError is caught by `errorHandler.ts` and returns structured 400 responses with field-level messages
- **Sanitization**: Audit middleware redacts sensitive keys (password, token, authorization) from logs
- **SQL injection**: Prevented by Prisma ORM — no raw SQL in the codebase
