# User Roles & Permissions Matrix

| Permission / Feature | PRINCIPAL | ADMIN | TEACHER | ACCOUNTANT | PARENT (V1) |
|---------------------|-----------|-------|---------|------------|-------------|
| View all students | ✅ | ✅ | ❌ (assigned classes only) | ❌ | ❌ (no login) |
| Create/edit students | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark attendance | ✅ | ✅ | ✅ (own classes, class teacher only) | ❌ | ❌ |
| View attendance reports | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Create fee structures | ✅ | ✅ | ❌ | ❌ | ❌ |
| Record payments | ✅ | ✅ | ❌ | ✅ | ❌ |
| View fee ledgers | ✅ | ✅ | ❌ | ✅ | ❌ |
| Fee adjustments (concession/discount) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create homework assignments | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Enter marks | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| View behaviour (counsellor notes) | ✅ | ✅ | ❌ (restricted) | ❌ | ❌ |
| Upload student documents | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send WhatsApp messages | ✅ | ✅ | ✅ | ❌ | ❌ |
| Dashboard access | ✅ (school-wide) | ✅ (school-wide) | ✅ (own classes) | ✅ (fees only) | ❌ |
| School settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage teachers/users | ✅ | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tenant deletion | ✅ (with password) | ❌ | ❌ | ❌ | ❌ |

**Super Admin** (platform-level, separate credentials in `.env`):
- View all onboarded schools
- Manage school activation/deactivation
- Process password reset requests
- View onboarding logs

> **Note**: `PARENT` role exists in schema but has no login UI in V1. Parents receive updates via WhatsApp only.
