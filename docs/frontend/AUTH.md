# Authentication Architecture

CampusLoom now uses a live authentication flow backed by the backend auth APIs.

## Auth State

Location: `frontend/src/features/auth/AuthContext.jsx`

The provider tracks:

- `user`
- `isAuthenticated`
- `isLoading`
- `authError`
- `login(email, password)`
- `register(email, password)`
- `logout()`

## Live Login Flow

Login uses the real backend sequence:

1. `POST /api/v1/auth/login`
2. Store the JWT with `setToken`
3. `GET /api/v1/auth/me`
4. Store the authenticated user in context and query cache

## Session Restore

On app load:

1. Check whether a token exists
2. Call `GET /api/v1/auth/me`
3. Restore the session if valid
4. Clear auth state if invalid

## Route Protection

The entire `/admin` route tree is wrapped with `ProtectedRoute`.

- Unauthenticated users are redirected to `/login`
- Non-admin users are redirected to `/unauthorized`
- The loading screen blocks render during session restoration

## API Integration

Feature APIs live in:

- `src/features/auth/api.js`

This keeps auth transport logic out of components.

## Security Notes

- Tokens are never displayed in the UI
- Bearer headers are attached only through the interceptor
- `401` responses clear the session globally
- Frontend auth is not trusted as an authorization boundary

## Next Improvements

- HttpOnly cookie migration
- Refresh token flow
- Rate-limit aware login UX
