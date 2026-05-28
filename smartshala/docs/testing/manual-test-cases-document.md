# Manual Test Cases Document

> ⚠️ **No formal manual test cases document exists.** However, the `AUDIT_CHANGES.md` (553 lines) serves as a de facto acceptance checklist with screen-by-screen verification items.

The `docs/database/neon-migration.md` contains a validation checklist:
- `npm run prisma:generate`
- `npx prisma migrate status`
- Login APIs
- Demo principal login
- Student/class/attendance/fees CRUD flows
- Dashboard and analytics queries
- `/health/db` returns `status: ok`
