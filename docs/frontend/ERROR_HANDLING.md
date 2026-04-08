# Frontend Error Handling

This document defines the production-safe error handling strategy for the CampusLoom frontend.

## Goals

- Prevent admin routes from crashing when backend modules are missing or incomplete
- Keep API failures inside controlled UI states
- Standardize sanitised error messages across features
- Avoid retry storms against unstable or unavailable endpoints

## API Error Handling Strategy

Shared client: `frontend/src/lib/api.js`

Rules:

- Every request goes through the shared Axios client
- The base URL is normalised to a single `/api/v1` suffix
- Auth tokens are attached centrally
- `401` responses clear the token and notify auth listeners
- `404` and network failures can be downgraded to safe fallback data through `requestWithFallback`
- UI only receives sanitised messages, never raw backend stack traces

Normalised error shape:

```js
{
  status: 404,
  code: "ERR_BAD_REQUEST",
  message: "This feature is not available yet.",
  errors: [],
  isUnauthorized: false,
  isNotFound: true,
  isNetworkError: false,
  isTimeoutError: false,
  isRetryable: false,
  envelope: null
}
```

Normalised success shape:

```js
{
  data: {},
  envelope: {
    success: true,
    message: "Optional message",
    data: {}
  },
  meta: {
    success: true,
    message: "Optional message"
  }
}
```

## React Query Patterns

Shared client: `frontend/src/lib/queryClient.js`

Rules:

- `retry: false` for all queries and mutations by default
- Query hooks must gate on auth when required
- Components must explicitly handle `isLoading`, `isError`, and empty data
- 404-backed placeholder states should use fallback data instead of repeated retries

Recommended page pattern:

```jsx
if (isLoading) return <Loading />;
if (isError) return <ErrorState message={error.message} />;
if (!data) return <EmptyState />;
```

## Fallback UI System

Reusable states live in `frontend/src/components/common/`.

- `Loading.jsx`: neutral loading panel for generic async views
- `ErrorState.jsx`: sanitised retry-friendly failure panel
- `EmptyState.jsx`: stable empty or unavailable-state panel
- `RouteErrorBoundary.jsx`: route-level crash containment for rendering and router errors

Use cases:

- Backend unavailable: show `EmptyState` or feature placeholder
- Query failure without fallback: show `ErrorState`
- Route/render exception: handled by `RouteErrorBoundary`

## Defensive Coding Rules

- Never read nested API fields without guards
- Prefer `Array.isArray(data?.items) ? data.items : []`
- Prefer optional chaining for nested objects
- Never assume `generatedAt`, `charts`, or list collections exist
- Do not surface `error.response.data` directly in the UI
- Do not add ad hoc `try/catch` blocks inside components when a hook or shared helper can own the behavior

## Admin Stability Rules

- Every `/admin/*` route lives under `ProtectedRoute`
- Sidebar links must always point to an actual route
- Unimplemented modules must render a placeholder page, not a broken route
- Unknown admin routes redirect to `/admin`
- When the dashboard endpoint is missing or unavailable, the page renders fallback content instead of crashing

## Remaining Backend Dependencies

These admin modules still depend on backend readiness or dedicated frontend workflows:

- Users management UI
- Admissions admin workflows
- Notices publishing UI
- Settings management UI
- CMS page editor and CRUD surface for the existing pages API
