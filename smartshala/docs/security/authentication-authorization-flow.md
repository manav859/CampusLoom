# Authentication & Authorization Flow

```
1. Login: POST /api/auth/login
   ├── Accepts: identifier (email or phone) + password
   ├── Validates credentials via bcrypt.compare()
   ├── Returns: accessToken (JWT, 15min) + refreshToken (JWT, 7days) + user object
   └── Tokens stored in localStorage (client-side)

2. Protected Requests:
   ├── Client sends: Authorization: Bearer <accessToken>
   ├── requireAuth middleware verifies JWT signature
   ├── Extracts: sub (userId), schoolId, tenantSchoolId, role
   ├── Validates tenant mismatch if multi-tenant
   └── Populates req.user

3. Role Authorization:
   ├── requireRole(["PRINCIPAL", "ADMIN"]) middleware
   ├── Checks req.user.role against allowed roles
   └── Returns 403 if not permitted

4. Token Refresh:
   ├── RefreshToken model stores hashed tokens
   ├── Refresh endpoint validates and rotates tokens
   └── Revoked tokens tracked via revokedAt

5. Multi-Tenant Auth:
   ├── tenantMiddleware resolves /:schoolId to master DB record
   ├── Validates school is active and not trial-expired
   ├── Creates tenant-scoped Prisma client via AsyncLocalStorage
   └── JWT contains tenantSchoolId for cross-validation
```

**Session Management**: Client-side localStorage (`smartshala.accessToken`, `smartshala.refreshToken`, `smartshala.user`). On 401 response, tokens are cleared and user is redirected to `/login`.
