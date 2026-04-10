# Frontend Auth Architecture

CampusLoom now uses a shared auth system for `admin`, `student`, and `teacher` accounts.

## Auth State

Location: `frontend/src/features/auth/AuthContext.jsx`

The provider exposes:

- `user`
- `isAuthenticated`
- `hasStoredSession`
- `isLoading`
- `authError`
- `login(email, password)`
- `register(payload)`
- `logout()`

`register(payload)` expects:

```json
{
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "password": "strong-password",
  "role": "student"
}
```

## Login Flow

1. `POST /api/v1/auth/login`
2. Store the JWT in the token abstraction
3. Cache the returned user immediately
4. Redirect by role:
   - `admin` -> `/admin`
   - `student` or `teacher` -> `/account`

If the user was redirected to a protected route first, the client only reuses that destination when it matches the signed-in role boundary.

## Registration Flow

Route: `/register`

Form fields:

- `name`
- `email`
- `password`
- `role`

Validation stack:

- `react-hook-form`
- `zod`

Role selector values are limited to:

- `student`
- `teacher`

The UI never offers `admin`.

After a successful registration, the user is redirected to `/login`.

## Session Restore

On app boot:

1. Read the stored token
2. If present, call `GET /api/v1/auth/me`
3. Restore the user into context
4. Clear the session if the token is invalid

## Route Protection

### `/admin`

- wrapped in `ProtectedRoute`
- allowed roles: `admin`

### `/account`

- wrapped in `ProtectedRoute`
- allowed roles: `student`, `teacher`

Unauthenticated users are redirected to `/login`.
Authenticated users without the required role are redirected to `/unauthorized`.

## Navigation Behavior

Public navbar behavior:

- signed out: show `Sign In`
- signed in as student/teacher: show `My Account` and `Logout`
- signed in as admin: show `Admin Dashboard` and `Logout`

Logout clears the token, clears auth-backed query state, and returns the user to `/`.

## Admissions Integration

The public admissions page still uses the same form, but now:

- signed-in users have `name` and `email` prefilled
- successful submissions made while signed in appear in `/account`
- the account dashboard reads from `GET /api/v1/user/admissions`

## Account Dashboard

Route: `/account`

The page shows:

- current user name
- email
- role
- linked admissions history

Admissions are rendered from a dedicated React Query hook:

- `frontend/src/features/admissions/hooks/useCurrentUserAdmissions.js`

## Security Notes

- The frontend never trusts itself as an authorization boundary.
- Bearer headers are attached centrally through the Axios interceptor.
- Global `401` responses clear the session.
- Admin creation is intentionally absent from the public UI.
- Role-based redirects avoid mixing admin and end-user destinations after login.
