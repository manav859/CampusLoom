# SchoolOS Authentication & RBAC

This document outlines the architecture, flow, and security measures of the SchoolOS (CampusLoom) authentication system.

## 1. Authentication Flow

The current implementation utilizes JSON Web Tokens (JWT) for stateless authentication.

**Registration (`POST /api/v1/auth/register`)**
- Validates input (email, password) using `zod`.
- Checks if the email is already in use.
- **Seeding logic:** On the first execution, if no roles exist in the database, `ADMIN` and `USER` roles are automatically generated.
- The **first registered user** receives the `ADMIN` role. Subsequent users default to the `USER` role.
- Before storing the password in the MongoDB database, it is irreversibly hashed.

**Login (`POST /api/v1/auth/login`)**
- Validates the provided credentials against the hashed password.
- Ensures the user account is active.
- Generates a JWT containing the `userId` and `role`.
- The token is returned to the client to be included in subsequent requests as an `Authorization` header (`Bearer <token>`).

**Me (`GET /api/v1/auth/me`)**
- A protected route that verifies the JWT token.
- Returns the currently authenticated user's details without exposing sensitive info (like passwords).

## 2. JWT Strategy

- **Token Secret**: Sourced from the `JWT_SECRET` environment variable. Ensure this is a strong (32+ character) string.
- **Expiry**: Currently hardcoded to `1h` (1 hour) to balance security and convenience.
- **Payload Structure**: 
  ```json
  {
    "userId": "60d0fe4f5311236168a109ca",
    "role": "ADMIN",
    "iat": 1616239022,
    "exp": 1616242622
  }
  ```
- **Transmission**: The frontend should store the token securely (preferably in memory or careful usage of local storage, transitioning to HttpOnly cookies eventually). It must be attached via `Authorization: Bearer <token>`.

## 3. RBAC Design (Role-Based Access Control)

Roles dictate what a user can and cannot do in SchoolOS.

- **Role Model**: Independent entity in the database (e.g., `name: 'ADMIN'`).
- **Assignment**: Each `User` references precisely one `Role` (Object ID relation).
- **Middleware**: 
  - `authenticate`: Initially verifies the JWT, ensures the user still exists and isActive, and mounts the user object (including role text) to `request.user`.
  - `authorizeRoles(allowedRoles)`: A higher-order function to protect specific sub-routes. For example, `authorizeRoles(['ADMIN', 'EDITOR'])`.

## 4. Security Decisions

Strict guidelines adhered to during the Day 2 construction:

1. **Password Hashing**: Done via `bcrypt` with salt rounds retrieved from `BCRYPT_SALT_ROUNDS` (fallback `10`). Passwords are never logged in plain-text.
2. **Hidden Queries**: In Mongoose, the user model excludes `password` by default (`select: false`). The service layer explicitly opts-in to selecting it only during login comparison.
3. **Generic Errors**: The system deliberately uses generalized authentication errors (e.g., "Invalid credentials") rather than specific ones (e.g., "Email not found" vs "Wrong password") to prevent user-enumeration attacks.
4. **Validation-First**: Zod validation precedes any database operations to reject malformed data early, shielding against unhandled injections or ReDoS vulnerabilities.
5. **No Secret Bleed**: Standard practice ensuring variables remain strictly bounded to `env.js`, verified systematically on startup.

## 5. Future Improvements

- **Refresh Tokens**: Implement short-lived access tokens combined with long-lived, rotatable refresh tokens stored in secure, HttpOnly cookies for enterprise-grade security.
- **Granular Permissions**: Augment the RBAC model to map specific roles to a `Permissions` list (e.g., `canEditGrades`, `canViewFinances`), replacing hardcoded string compares with robust entity rules.
- **Rate Limiting**: Integrate `@fastify/rate-limit` for brutal force protection extensively on the `login` route.
- **Account Lockouts**: Temporarily block user IDs after X consecutive failed login attempts.
- **Audit Logs Middleware**: Tie an audit recording service directly into the `authenticate` pipeline logging data mutations.
