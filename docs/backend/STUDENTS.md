# Students Backend

This document describes the Day 7 student management system shipped for CampusLoom.

## Architecture

Location: `backend/src/modules/students/`

Files:

- `student.model.js` — student persistence model
- `students.schema.js` — Zod request validation
- `students.service.js` — business rules and data access
- `students.controller.js` — Fastify handlers and error normalization
- `students.route.js` — route registration

The module follows the repo-standard controller/service split and response envelope helpers.

## Data Model

### Student

- `id`
- `name`
- `email`
- `phone`
- `class`
- `admissionId` — unique reference to the originating `Admission` record
- `userId` — nullable reference to the `User` authentication account
- `createdAt`
- `updatedAt`

Indexes:

- `{ class, createdAt }` — class-based listing
- `{ userId }` — sparse, user-scoped lookups
- `{ admissionId }` — unique, prevents duplicate conversions

## Route Layout

All routes are admin-protected (`authenticate` + `authorizeRoles(['admin'])`).

- `GET /api/v1/students` — list all students, optional `?class=` filter
- `GET /api/v1/students/:id` — get student detail
- `DELETE /api/v1/students/:id` — delete student

## Validation Rules

List query:

- `class` optional, trimmed, max 80 chars

ID param:

- validated against an ObjectId-safe regex before any database query

## Admission → Student Conversion

When an admin sets an admission's status to `approved`, the `updateAdmissionStatus` function in the admissions service automatically calls `createStudentFromAdmission()`.

Behavior:

1. Checks if a student already exists for the given `admissionId` (idempotent).
2. If no student exists, creates one using the admission's name, email, phone, class, and userId.
3. If the conversion fails, the error is logged but the status update still succeeds — the student can be created by re-approving.

This means students are never created manually — they are always the product of an approved admission.

## Security Decisions

- All student routes are admin-only
- Student records expose only safe fields (no password, no internal IDs beyond what's necessary)
- Input validation runs before service execution
- Error responses stay inside the standard safe response envelope
- The unique `admissionId` index prevents duplicate student records

## Edge Cases Handled

- Malformed ObjectIds in params
- Non-existent student on GET/DELETE
- Duplicate admission → student conversion (idempotent, returns existing record)
- Empty student roster (no admissions approved yet)
- Admission without userId (student created with null userId)

## Multi-Tenancy Note

The runtime is still effectively single-tenant. The students module keeps the same constraint as other persisted modules and should receive formal `schoolId` enforcement when the shared tenant context lands.
