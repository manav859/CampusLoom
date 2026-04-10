# Admissions Frontend

This document describes the admissions feature shipped on the CampusLoom frontend.

## Feature Layout

Location: `frontend/src/features/admissions/`

Files:

- `api.js` - transport helpers, query keys, status options
- `schema.js` - form validation rules
- `utils.js` - formatting and payload mapping helpers
- `hooks/` - React Query query and mutation hooks
- `components/` - public form, admin table, notes panel, status badge

Pages:

- `src/pages/public/AdmissionsPage.jsx`
- `src/pages/admin/AdmissionsPage.jsx`
- `src/pages/admin/AdmissionDetailPage.jsx`

## Public Flow

Route:

- `/admissions`

Behavior:

- renders a real inquiry form instead of a brochure-style placeholder
- validates required fields with `react-hook-form` + `zodResolver`
- submits to `POST /api/v1/admissions`
- shows inline server errors
- switches to a success state after submission with inquiry reference and initial status

Payload mapping:

- `classLevel` form field maps to backend field `class`

## Admin Flow

Routes:

- `/admin/admissions`
- `/admin/admissions/:id`

Queue page behavior:

- loads the admissions list through React Query
- shows operational counts for `new`, `in_review`, `approved`, and `rejected`
- filters the queue by status without leaving the page
- links directly into the review detail screen

Detail page behavior:

- hydrates the full inquiry in one request
- shows contact information, message, timestamps, and current status
- lets staff update the status through a dedicated action
- lets staff append internal notes and immediately refresh the record through query invalidation

## Query Strategy

Query keys:

- `['admissions', 'admin', 'list']`
- `['admissions', 'admin', 'detail', admissionId]`

Mutations invalidate the list and targeted detail query so the desk view and detail view stay coherent after status or note changes.

## Validation Rules

Public form:

- `name` required
- `phone` required and digit-count checked
- `email` required and valid
- `classLevel` required
- `message` optional

Notes form:

- `note` required
- `note` max 1000 chars

## Error Handling

- list/detail screens use shared `Loading`, `ErrorState`, and `EmptyState`
- public submission errors render inline in the form card
- missing admin records degrade to a safe empty-state screen
- status mutation errors render inline beside the status control
- note mutation errors stay local to the notes panel

## Security Decisions

- admin requests run through the shared authenticated API client
- public page never renders internal notes or admin-only metadata
- user-provided message text is rendered as plain React text, not HTML
- protected admin routes continue to rely on the parent `ProtectedRoute`

## Edge Cases Handled

- empty admissions queue
- empty results for a selected status filter
- invalid direct navigation to `/admin/admissions/:id`
- repeated status saves when the value has not changed
- inquiries without a message
- inquiries with no notes yet
