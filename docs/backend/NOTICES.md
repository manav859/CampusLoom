# Notices Backend

This document describes the production notices system implemented for CampusLoom.

## Architecture

Location: `backend/src/modules/notices/`

Files:

- `notice.model.js` - Mongoose notice persistence model
- `notices.schema.js` - Zod request validation
- `notices.service.js` - business rules and data access
- `notices.controller.js` - Fastify handlers and error normalization
- `notices.routes.js` - admin/public route registration
- `notices.route.js` - compatibility re-export for the existing app import

Although the Day 5 brief referenced Prisma, the live backend stack in this repository is Fastify + MongoDB + Mongoose. A Prisma schema mirror was also updated in `backend/prisma/schema.prisma` so the database contract remains documented there.

## Data Model

`Notice` fields:

- `id`
- `title`
- `content`
- `type` - `general | exam | holiday | urgent`
- `publishDate`
- `expiryDate` - nullable
- `isActive`
- `createdBy` - `User` reference
- `createdAt`
- `updatedAt`

Indexes:

- `{ isActive, publishDate, expiryDate }`
- `{ type, publishDate }`

## Route Layout

Protected admin routes:

- `POST /api/v1/notices`
- `GET /api/v1/notices`
- `GET /api/v1/notices/:id`
- `PUT /api/v1/notices/:id`
- `DELETE /api/v1/notices/:id`
- `PATCH /api/v1/notices/:id/status`

Public route:

- `GET /api/v1/public/notices`

`GET /api/v1/notices/:id` was added to support safe edit-page hydration on direct navigation and refresh.

## Validation Flow

Validation is handled in `notices.schema.js` with Zod before service execution.

Rules:

- `title` is required, trimmed, max 200 chars
- `content` is required, trimmed, max 5000 chars
- `type` must match the allowed enum
- `publishDate` must be a valid date
- `expiryDate` is optional and nullable
- `expiryDate` must be later than `publishDate`
- update payloads must include at least one field

Service-level schedule validation runs again during updates so partial payloads cannot bypass publish/expiry ordering rules.

## Public Visibility Rules

Public notices are filtered with all of the following conditions:

- `isActive === true`
- `publishDate <= now`
- `expiryDate >= now` when `expiryDate` exists

Sorting:

- `publishDate` descending
- `createdAt` descending

This ensures future notices stay hidden, expired notices disappear automatically, and inactive notices never leak to the public API.

## Notice Lifecycle

1. Admin sends a validated create or update request.
2. Controller parses input with Zod.
3. Service normalizes text, validates scheduling, and persists the document.
4. Public consumers can read the notice only when its active window is valid.
5. Admin can deactivate or delete the notice at any time.

## Security Decisions

- All admin routes are protected by `authenticate` and `authorizeRoles(['ADMIN'])`.
- Public responses exclude `createdBy` and any other admin-only metadata.
- Content is stored and rendered as plain text. No server-side HTML rendering path exists in this feature.
- Input is validated before database access.
- IDs are validated with ObjectId-safe regex checks.
- Error responses use the repo-standard envelope and do not expose stack traces.

## Future Considerations

- Add formal `schoolId` enforcement once the shared multi-tenant request context lands across persisted modules.
- Add pagination and search for large notice volumes.
- Add audit-log writes on create/update/delete/status changes.
