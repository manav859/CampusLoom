# Admissions Backend

This document describes the Day 6 admissions system shipped for CampusLoom.

## Architecture

Location: `backend/src/modules/admissions/`

Files:

- `admission.model.js` - inquiry persistence model
- `admission-note.model.js` - internal notes model
- `admissions.schema.js` - Zod request validation
- `admissions.service.js` - business rules and data access
- `admissions.controller.js` - Fastify handlers and error normalization
- `admissions.routes.js` - live route registration
- `admissions.route.js` - compatibility re-export used by the app bootstrap

The module follows the repo-standard controller/service split and response envelope helpers.

## Data Model

### Admission

- `id`
- `name`
- `phone`
- `email`
- `class`
- `message` - nullable
- `status` - `new | in_review | approved | rejected`
- `createdAt`
- `updatedAt`

Indexes:

- `{ status, createdAt }`
- `{ email, phone, class, createdAt }`

### AdmissionNote

- `id`
- `admissionId`
- `note`
- `createdBy` - `User` reference
- `createdAt`

Indexes:

- `{ admissionId, createdAt }`

## Route Layout

Public route:

- `POST /api/v1/admissions`

Protected admin routes:

- `GET /api/v1/admissions`
- `GET /api/v1/admissions/:id`
- `PATCH /api/v1/admissions/:id/status`
- `POST /api/v1/admissions/:id/notes`

The admin detail route returns the inquiry plus the full internal notes array so the frontend can hydrate the review screen in one request.

## Validation Rules

Public inquiry payload:

- `name` required, trimmed, max 120 chars
- `phone` required, 7-15 digits after normalization
- `email` required, valid email format
- `class` required, trimmed, max 80 chars
- `message` optional, max 1500 chars

Admin note payload:

- `note` required, trimmed, max 1000 chars

Admin status payload:

- `status` must be one of `new`, `in_review`, `approved`, `rejected`

IDs are validated against an ObjectId-safe regex before any database query runs.

## Workflow Behavior

1. Public user submits an inquiry.
2. Controller validates the payload with Zod.
3. Service normalizes name, phone, email, class, and message fields.
4. Service applies duplicate-spam protection before insert.
5. New records enter the system with status `new`.
6. Admin reviews the inquiry, updates the status, and appends internal notes over time.

## Spam Protection

The public endpoint applies a basic duplicate-submission rule:

- if the same `email` or `phone` submits another inquiry for the same `class` within 10 minutes, the API returns `429`

This is intentionally simple and local to the module. It reduces accidental double submissions and low-effort spam without introducing external rate-limiting infrastructure.

## Security Decisions

- Admin routes are protected by `authenticate` and `authorizeRoles(['ADMIN'])`
- Public create responses expose only `id`, `status`, and `createdAt`
- Internal notes are never exposed on the public endpoint
- Admin note authors expose only safe metadata: `id` and `email`
- Input validation runs before service execution
- Error responses stay inside the standard safe response envelope

## Edge Cases Handled

- malformed ObjectIds
- blank or malformed public fields
- invalid status values
- empty notes
- missing admission records on detail/status/note requests
- duplicate public submissions in a short time window
- optional message omitted cleanly as `null`

## Multi-Tenancy Note

The runtime is still effectively single-tenant because tenant context is not yet propagated through auth or public domain resolution in this repository. The admissions module keeps the same current constraint as other persisted modules and should receive formal `schoolId` enforcement when the shared tenant context lands.
