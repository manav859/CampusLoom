# Coding Standards / Conventions Used

| Convention | Detail |
|-----------|--------|
| **Language** | TypeScript (strict mode) throughout |
| **Module system** | ES Modules (`"type": "module"` in backend) |
| **Target** | ES2022 (backend), Next.js default (frontend) |
| **Module pattern** | Each feature module: `module.routes.ts` → `module.controller.ts` → `module.service.ts` → `module.schemas.ts` |
| **Naming** | camelCase for variables/functions, PascalCase for types/models, SCREAMING_SNAKE for enums |
| **File naming** | kebab-case for middleware/utils, camelCase for modules |
| **API style** | RESTful with consistent JSON error format: `{ error: { code, message, details? } }` |
| **Database IDs** | UUIDs throughout (no auto-increment) |
| **Tenant isolation** | Every query scoped by `schoolId` |
| **Error handling** | Custom `AppError` class with status code, message, and error code |
| **Validation** | Zod schemas at request boundary |
| **Logging** | Pino structured JSON logging |
