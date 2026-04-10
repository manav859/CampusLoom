# CampusLoom Backend Auth

CampusLoom now supports three account roles:

- `admin`
- `student`
- `teacher`

Public registration is limited to `student` and `teacher`. Admin accounts are not exposed through the public API.

## Auth Endpoints

### `POST /api/v1/auth/register`

Public account creation for student and teacher users.

Request body:

```json
{
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "password": "strong-password",
  "role": "student"
}
```

Rules:

- `role` must be `student` or `teacher`
- `admin` is rejected even if submitted manually
- email is normalized to lowercase
- passwords are hashed with `bcrypt`
- duplicate emails return `409`

Response data:

```json
{
  "id": "user_id",
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "role": "student",
  "isActive": true,
  "createdAt": "2026-04-09T12:00:00.000Z",
  "updatedAt": "2026-04-09T12:00:00.000Z"
}
```

### `POST /api/v1/auth/login`

Shared login for admin, student, and teacher accounts.

Request body:

```json
{
  "email": "aarav@example.com",
  "password": "strong-password"
}
```

Response data:

```json
{
  "token": "jwt",
  "user": {
    "id": "user_id",
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "role": "student",
    "isActive": true,
    "createdAt": "2026-04-09T12:00:00.000Z",
    "updatedAt": "2026-04-09T12:00:00.000Z"
  }
}
```

### `GET /api/v1/auth/me`

Protected session restore endpoint. Returns the authenticated user already attached by middleware.

## User Admissions API

### `GET /api/v1/user/admissions`

Protected route for signed-in `student` and `teacher` accounts.

Behavior:

- filters by `request.user.id`
- never returns other users' admission records
- sorts newest first

Example response data:

```json
[
  {
    "id": "admission_id",
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "phone": "+919876543210",
    "class": "Grade 6",
    "message": "Sibling already enrolled",
    "status": "new",
    "createdAt": "2026-04-09T12:10:00.000Z",
    "updatedAt": "2026-04-09T12:10:00.000Z"
  }
]
```

## Admissions Linking

Admission submissions remain public at `POST /api/v1/admissions`, but the route now supports an optional authenticated caller.

Behavior:

- no token: admission is created normally with `userId: null`
- valid student/teacher token: admission is created with `userId` attached
- invalid token: request is rejected
- admin token: request is accepted, but the admission is not linked into the student/teacher account flow

This keeps the public form usable while preserving strict ownership checks for account dashboards.

## Data Model

### User

Runtime model fields:

- `id`
- `name`
- `email`
- `password`
- `role`
- `isActive`
- `createdAt`
- `updatedAt`

The codebase still retains an optional legacy `roleId` relation so older admin records can continue to authenticate while the system moves to direct role storage.

### Admission

Relevant fields:

- `id`
- `name`
- `phone`
- `email`
- `class`
- `message`
- `status`
- `userId`
- `createdAt`
- `updatedAt`

`schema.prisma` was updated to mirror the new `User` and `Admission` shapes even though the current runtime path is Mongoose-backed.

## Middleware and RBAC

### `authenticate`

- verifies JWT
- loads the latest user from the database
- rejects inactive or missing users
- resolves the normalized role
- attaches a safe user object to `request.user`

### `authenticateOptional`

- ignores missing tokens
- rejects invalid or expired tokens
- attaches `request.user` when a valid token is present

### `authorizeRoles([...])`

- compares normalized lower-case roles
- currently used to keep `/admin` APIs admin-only and `/api/v1/user/admissions` student/teacher-only

## Security Decisions

- Public registration cannot create admins.
- Login returns safe user fields only; passwords are never exposed.
- The middleware re-reads the user from storage on each protected request, so deleted or deactivated accounts lose access immediately.
- User admissions are filtered by `userId` server-side; the frontend is not trusted for scoping.
- Invalid credentials stay generic.
- Zod validation runs before writes.
- Duplicate admissions are still rate-limited by the recent-contact window in the admissions service.

## Edge Cases Handled

- Duplicate email on register
- Manual role escalation attempt to `admin`
- Inactive user login
- Legacy admin records that still rely on `roleId`
- Public admission submission without authentication
- Authenticated admission submission with automatic ownership linking
- Logged-in users trying to read another user's admissions
