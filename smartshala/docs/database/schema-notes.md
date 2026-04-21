# Database Schema Notes

The Prisma schema is in `backend/prisma/schema.prisma`.

## Tenancy

`School` is the root tenant. Users, classes, students, attendance sessions, fees, payments, receipts, and notifications all carry `schoolId`.

## Attendance

- `AttendanceSession` represents one class on one date.
- `AttendanceRecord` stores one row per student per session.
- Unique key: `schoolId + classId + date`.
- Teachers cannot resubmit an existing session; admin can edit.

## Fees

- `FeeStructure` defines annual/monthly/quarterly/custom fees.
- `FeeInstallment` stores installment names, amounts, and due dates.
- `StudentFeeAssignment` stores student balance snapshots.
- `Payment` records partial or full payment.
- `Receipt` provides receipt numbers linked to payments.

## Notifications

`Notification` stores WhatsApp-ready messages, recipient phone, status, provider message ID, error, and timestamps.

