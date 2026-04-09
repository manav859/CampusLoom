# SchoolOS Frontend Error Handling & Stability

This document outlines the standard patterns for keeping the admin interface stable, even in the event of missing or failing backend services.

## Core Philosophy

The primary objective for the admin application is **zero runtime crashes**. Given that features may be partially complete, the UI must defensively fall back to safe states rather than throw unhandled promise rejection errors or "Cannot read property of undefined".

## 1. Global API Layer Fail-Safes

A custom Axios instance (`src/lib/api.js`) handles common backend response issues seamlessly.

- **`401 Unauthorized`**: Automatically wipes tokens and forces a redirect to the login page to maintain strict security boundaries.
- **`404 Not Found`**: Handled via `isFallback: true` for `GET` requests instead of throwing. This allows React Query to register the query as "successful" with empty stub data, triggering standard empty UI states rather than aggressive error screens.
- **Network timeouts/disconnects**: Gracefully handled by the fallback mechanism or rendered into proper `isError` cases for React Query.

## 2. Component Rendering Safety

Never assume the depth or shape of data fetched dynamically.

### Optional Chaining & Nullish Coalescing
Before mapping or checking length, always verify the array is valid:

**Do NOT Use:**
```javascript
data.items.map(...)
```

**USE THIS INSTEAD:**
```javascript
// Using fallback assignments for array rendering
const itemsList = Array.isArray(data?.items) ? data.items : [];
{itemsList.map(...)}
```

### 3. Fallback UI Ecosystem

Use the standardized components located in `src/components/common/` rather than re-creating them.

- **`<Loading />`**: For major page transitions or data fetching blocks.
- **`<ErrorState />`**: For unrecoverable data access errors or missing permissions. Use the `onAction` prop to offer refetch functionality.
- **`<EmptyState />`**: For lists that have 0 items, or features that rely on a 404 stub (e.g., when the backend feature is missing).

## 4. React Query Defaults

To avoid retry storms against dead endpoints, React Query must abide by specific `queryClient` configurations:
- `retry: false` - Avoid repeating 404s endlessly.
- `throwOnError: false` - Explicitly use the returned `isError` boolean, not error boundaries.
