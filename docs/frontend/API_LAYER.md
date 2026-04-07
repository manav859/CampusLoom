# API Layer Design

CampusLoom frontend uses a centralized **Axios instance** paired with **TanStack React Query** for robust server state management.

## Axios Instance (`src/lib/api.js`)

### Configuration

| Setting         | Value                                    |
| --------------- | ---------------------------------------- |
| Base URL        | `VITE_API_URL` (env variable)            |
| Timeout         | 15 seconds                               |
| Content-Type    | `application/json`                       |

### Request Interceptor
- **Phase 1**: No-op pass-through
- **Phase 2**: Attaches `Authorization: Bearer <token>` header from auth store

### Response Interceptor
- **Success**: Unwraps the backend envelope — returns `response.data` directly (the `{ success, message, data }` object)
- **Error**: Extracts structured error from the backend envelope:
  ```js
  {
    status: 401,
    message: "Human-readable error",
    errors: [...],  // Zod validation errors
    raw: axiosError
  }
  ```
- **Phase 2**: 401 responses will trigger automatic redirect to `/login`

### Usage

```js
import api from '@/lib/api';

// GET request — response is the unwrapped envelope
const health = await api.get('/health');
console.log(health.data.uptime); // Direct access to data

// POST request
const result = await api.post('/auth/login', { email, password });
```

## React Query (`src/lib/queryClient.js`)

### Default Configuration

| Option                 | Value     | Rationale                              |
| ---------------------- | --------- | -------------------------------------- |
| `staleTime`            | 5 minutes | Reduce unnecessary refetches           |
| `gcTime`               | 10 minutes| Keep inactive cache for smooth UX      |
| `retry`                | 1         | Single retry to avoid API hammering    |
| `refetchOnWindowFocus` | `false`   | Dev-friendly, enable in production     |

### Usage Pattern

```jsx
// In a hook file: src/features/health/hooks/useHealth.js
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health'),
  });
}

// In a page component
import { useHealth } from '@/features/health/hooks/useHealth';

function DashboardPage() {
  const { data, isLoading, error } = useHealth();
  // ...
}
```

### Query Key Conventions

| Pattern                     | Example                              |
| --------------------------- | ------------------------------------ |
| Entity list                 | `['users']`                          |
| Entity list with filters    | `['users', { role: 'teacher' }]`     |
| Single entity               | `['users', userId]`                  |
| Nested resource             | `['users', userId, 'attendance']`    |

## Backend API Contract

The frontend expects all backend responses to follow the standard envelope:

### Success
```json
{
  "success": true,
  "message": "Optional message",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "errors": [...]
}
```

See `docs/backend/API_CONTRACT.md` for the full contract specification.

## Security Considerations

1. **No secrets in frontend code** — all sensitive configuration lives in `.env` (gitignored)
2. **JWT tokens**: Will be stored securely (Phase 2 — HttpOnly cookies preferred, localStorage as fallback)
3. **CORS**: Backend restricts origins to `CORS_ORIGIN` env var
4. **No raw HTML injection**: React's JSX escapes by default; never use `dangerouslySetInnerHTML`
5. **Input validation**: Client-side validation enhances UX but is never a substitute for backend Zod validation
