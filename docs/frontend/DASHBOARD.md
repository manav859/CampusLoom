# Dashboard Integration

CampusLoom Day 3 delivers a live admin dashboard backed by authenticated API calls and React Query.

## Architecture

The dashboard uses a feature-based slice:

```text
frontend/src/features/dashboard/
  api.js
  hooks/
    useDashboardStats.js
  components/
    DashboardCharts.jsx
    DashboardRecentActivity.jsx
    DashboardSkeleton.jsx
    DashboardStatsGrid.jsx
```

The page layer stays thin:

- `src/pages/admin/DashboardPage.jsx` orchestrates data and layout
- `src/features/dashboard/api.js` owns the backend contract
- `src/features/dashboard/hooks/useDashboardStats.js` owns React Query integration
- `src/features/dashboard/components/*` render data, loading, and empty states

## API Contract

The admin dashboard consumes:

- `GET /api/v1/dashboard/stats`

This endpoint is protected and requires a valid bearer token. The backend currently returns:

- `generatedAt`
- `stats`
- `charts.userRegistrations`
- `charts.entityDistribution`
- `recentActivity`
- `moduleStatus`

## React Query Pattern

Dashboard data uses:

- Query key: `['dashboard', 'stats']`
- `useQuery` for cached server state
- Global cache defaults from `src/lib/queryClient.js`
- `enabled: isAuthenticated` to prevent unauthenticated fetches

This avoids duplicate requests and keeps refresh behavior explicit.

## Auth-Aware Fetching

The dashboard never fetches unless the user is authenticated.

Protection happens in two layers:

- Route level: `ProtectedRoute` wraps the entire `/admin` tree
- Request level: the Axios interceptor attaches the bearer token automatically

If the backend returns `401`, the global unauthorized handler clears the session and the route guard redirects back to `/login`.

## Error Handling

The dashboard uses consistent states:

- Loading: `DashboardSkeleton`
- Error: `ApiErrorState`
- Empty: `EmptyState`

This keeps UI concerns separate from transport and data logic.

## Security Notes

- Tokens are never rendered in the UI
- Requests never set auth headers manually inside components
- Backend authorization still decides access to dashboard data
- Frontend route protection is UX only, not a trust boundary

## Day 4 Ready

The dashboard is ready for extension into:

- admission analytics
- notice publishing activity
- audit log timelines
- module-specific drill-down pages
- chart code-splitting if bundle size needs to be reduced
