# Results Backend

This document describes the Day 7 results system shipped for CampusLoom.

## Architecture

Location: `backend/src/modules/results/`

Files:

- `result.model.js` — result persistence model
- `results.schema.js` — Zod request validation
- `results.service.js` — business rules and data access
- `results.controller.js` — Fastify handlers and error normalization
- `results.route.js` — route registration (replaced the original placeholder)

The module follows the repo-standard controller/service split and response envelope helpers.

## Data Model

### Result

- `id`
- `studentId` — reference to the `Student` record
- `subject`
- `marks` — numerical score (min: 0)
- `maxMarks` — maximum possible score (min: 1)
- `examType` — `midterm | final | unit_test | practical`
- `createdAt`

Indexes:

- `{ studentId, examType }` — efficient student+exam queries
- `{ studentId, subject, examType }` — unique, prevents duplicate entries

## Route Layout

### Admin Routes (protected)

- `POST /api/v1/results` — create a result for a student
- `GET /api/v1/results/:studentId` — get all results for a specific student

### User Route (protected)

- `GET /api/v1/user/results` — get logged-in user's own results

## Validation Rules

Create result payload:

- `studentId` required, valid ObjectId
- `subject` required, trimmed, max 120 chars
- `marks` required, number, min 0
- `maxMarks` required, number, min 1
- `marks` must be ≤ `maxMarks` (cross-field validation via Zod `.refine()`)
- `examType` required, must be one of `midterm`, `final`, `unit_test`, `practical`

Student ID param:

- validated against an ObjectId-safe regex

## Workflow Behavior

1. Admin navigates to the results page and selects a student.
2. Admin fills in subject, marks, max marks, and exam type.
3. Controller validates the payload with Zod (including marks ≤ maxMarks).
4. Service checks that the student exists (404 if not).
5. Service checks for duplicate entry (409 if same student+subject+examType exists).
6. Result is created and returned.

### User-Scoped Access

1. Authenticated user requests `GET /user/results`.
2. Service looks up the `Student` record linked to the user's `userId`.
3. If no student record is found, returns an empty array (not an error).
4. If found, returns all results for that student.

## Security Decisions

- Admin routes are protected by `authenticate` and `authorizeRoles(['admin'])`
- User results endpoint is protected by `authenticate` and `authorizeRoles(['student', 'teacher'])`
- Users can only access their own results — the lookup is by `userId` from the JWT, not from request params
- No user can see another user's results
- Input validation runs before service execution
- Error responses follow the standard safe response envelope
- The unique compound index prevents duplicate result entries

## Edge Cases Handled

- Malformed ObjectIds in params or body
- Non-existent student on result creation or lookup
- Duplicate result entry (same student + subject + exam type)
- Marks exceeding max marks
- Negative marks
- User without a linked student record (returns empty array)
- Zero max marks prevented by validation

## Multi-Tenancy Note

The runtime is still effectively single-tenant. The results module keeps the same constraint as other persisted modules and should receive formal `schoolId` enforcement when the shared tenant context lands.
