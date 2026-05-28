# Data Retention Policy

> ⚠️ **No formal data retention policy exists.** Current behavior:
- Student records use soft delete (`isActive: false`)
- User records use soft delete (`status: INACTIVE`)
- Audit logs are append-only (never deleted)
- Tenant databases can be deleted with 3-day cancellation window
- No automated data purge or archival
