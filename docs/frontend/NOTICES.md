# Notices Frontend

This document describes the notices feature on the CampusLoom frontend.

## Feature Layout

Location: `frontend/src/features/notices/`

Files:

- `api.js` - API transport and query keys
- `schema.js` - form validation rules
- `utils.js` - formatting and payload mapping helpers
- `hooks/` - React Query hooks for admin/public flows
- `components/` - badges, table, form, and public card list

Pages:

- `src/pages/admin/NoticesPage.jsx`
- `src/pages/admin/NoticeCreatePage.jsx`
- `src/pages/admin/NoticeEditPage.jsx`
- `src/pages/public/NoticesPage.jsx`

## Admin Flow

Routes:

- `/admin/notices`
- `/admin/notices/new`
- `/admin/notices/:id`

Behavior:

- List page fetches admin notices through React Query.
- Create page uses `react-hook-form` + `zodResolver`.
- Edit page fetches the notice by id and pre-fills the form.
- Mutations invalidate both admin and public query keys to keep views coherent.

The admin table exposes:

- title
- type badge
- status badges
- publish date
- edit action
- delete action
- active toggle action

## Public Flow

Route:

- `/notices`

Behavior:

- Fetches from `/api/v1/public/notices`
- Renders safe text-only notice cards
- Highlights urgent notices visually
- Shows empty or fallback states instead of crashing when data is unavailable

## Query Strategy

Query keys:

- `['notices', 'admin', 'list']`
- `['notices', 'admin', 'detail', noticeId]`
- `['notices', 'public', 'list']`

Admin queries rely on authenticated access. Public queries use a safe fallback path so the public page still renders if the notices endpoint temporarily fails.

## Validation Logic

The admin form enforces:

- required title
- required content
- allowed type enum
- valid publish date
- optional valid expiry date
- expiry after publish

Before mutation submission, form values are transformed into ISO timestamps to match the backend contract.

## Error Handling

The feature follows the existing frontend stability rules:

- loading states use the shared `Loading` component
- request failures use `ErrorState`
- empty datasets use `EmptyState`
- public 404/network/timeouts fall back to a safe empty list shape
- admin mutation errors render inline feedback without tearing down the page

## Security Decisions

- All admin transport goes through the shared Axios client, so bearer token injection and global `401` logout continue to work automatically.
- Public notice content is rendered as normal React text, not raw HTML.
- Direct admin edit loads handle `404` safely with a fallback screen instead of an uncaught exception.

## Notice Lifecycle In UI

1. Admin creates or edits a notice.
2. Mutation invalidates admin/public caches.
3. Public page refetches the filtered notice list.
4. Users only see active, published, non-expired notices.
