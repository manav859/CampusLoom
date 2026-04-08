# API Layer Design

CampusLoom uses a centralized Axios client plus TanStack React Query for server state.

## Axios Instance

Location: `frontend/src/lib/api.js`

### Responsibilities

- Set the API base URL from `VITE_API_URL`
- Normalize the base URL to a single `/api/v1` suffix
- Apply a shared timeout and JSON headers
- Attach `Authorization: Bearer <token>` when a token exists
- Normalize backend success and error payloads into a consistent shape
- Trigger global unauthorized handlers on `401`
- Provide `requestWithFallback()` for safe 404 or network degradation

### Success Shape

```js
{
  data: {},
  envelope: {
    success: true,
    message: "Optional human-readable message",
    data: {}
  },
  meta: {
    success: true,
    message: "Optional human-readable message"
  }
}
```

### Error Shape

```js
{
  status: 401,
  code: "ERR_BAD_REQUEST",
  message: "Human-readable error",
  errors: [],
  isUnauthorized: true,
  isNotFound: false,
  isNetworkError: false,
  isTimeoutError: false,
  isRetryable: false
}
```

## Feature API Pattern

Components do not call Axios directly.

Example:

```js
// src/features/dashboard/api.js
import api, { requestWithFallback } from '@/lib/api';

export async function getDashboardStats() {
  return requestWithFallback(() => api.get('/dashboard/stats'), {
    fallbackStatusCodes: [404],
    fallbackOnNetworkError: true,
  });
}
```

## React Query Pattern

Hooks own fetching and caching rules.

```js
// src/features/dashboard/hooks/useDashboardStats.js
import { useQuery } from '@tanstack/react-query';
import { dashboardQueryKeys, getDashboardStats } from '../api';

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardQueryKeys.stats(),
    queryFn: getDashboardStats,
    retry: false,
  });
}
```

## Query Key Conventions

- Feature root: `['dashboard']`
- Single resource: `['dashboard', 'stats']`
- Auth current user: `['auth', 'me']`

## Security Notes

- Tokens are accessed only through `src/lib/auth.js`
- UI never sets auth headers manually
- `401` responses clear the session globally
- Backend stack traces or raw error payloads are never rendered directly in the UI
- Frontend checks improve UX, but backend authorization remains the source of truth
