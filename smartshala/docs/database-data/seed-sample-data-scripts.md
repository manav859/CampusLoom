# Seed / Sample Data Scripts

| File | Purpose |
|------|---------|
| `backend/prisma/seed.ts` (392 lines) | Main seed script — creates 1 school, 1 principal, 1 admin, 14 teachers, 24 classes (1A-12B), ~600+ students, fee structures, payments, receipts, exams, exam results, 20 days attendance |
| `backend/prisma/seed-april-attendance.ts` | Supplemental attendance seed for April |

**Seed Credentials**:
- Principal: `principal@smartshala.local` / `SmartShala@123`
- Admin: `admin@smartshalaahmedabad.edu.in` / `SmartShala@123`
- All teachers share password: `SmartShala@123`

**Run**: `cd backend && npm run seed`
