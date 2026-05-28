# Existing Automated Tests & How to Run Them

| Test File | Run Command | What It Tests |
|-----------|-------------|---------------|
| `tests/grading.test.ts` | `npm run test:grading` | Grade band calculation (A+, A, B, C, D, F) |
| `tests/studentAttendance.test.ts` | `npm run test:attendance` | Student attendance percentage calculation (single source of truth) |
| `tests/marksExamTerm.test.ts` | `npm run test:marks-term` | Marks and exam term validation |
| `tests/feeAdjustmentSchema.test.ts` | `npm run test:fee-adjustment` | Fee adjustment Zod schema validation |
| `tests/paymentReferences.test.ts` | (no npm script) | Payment reference field validation |

**Test runner**: `tsx` (direct TypeScript execution, no Jest/Vitest framework)
**Run all**: No single `npm test` command configured — tests must be run individually.

> ⚠️ **Test coverage is minimal.** Only 5 test files exist, focused on utility/schema validation. No integration tests, no API endpoint tests, no frontend tests.
