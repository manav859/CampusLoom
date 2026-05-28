# Known Vulnerabilities / Pending Security Fixes

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | JWT tokens stored in localStorage (vulnerable to XSS) | Medium | ⚠️ Known — no httpOnly cookie implementation |
| 2 | No CSRF protection (mitigated by Bearer token auth) | Low | ⚠️ Acceptable for API-only backend |
| 3 | Rate limiter is in-memory (`Map`) — resets on server restart, not shared across instances | Medium | ⚠️ Known — needs Redis-backed rate limiting for production scale |
| 4 | Super admin authentication uses bcrypt hash comparison directly in middleware — no JWT flow | Low | ⚠️ By design for platform-level access |
| 5 | No Content Security Policy (CSP) headers configured | Low | ⚠️ Helmet is active but CSP not customized |
| 6 | File uploads stored locally (`uploads/student-documents/`) — no CDN or cloud storage | Medium | ⚠️ Known — needs S3/GCS for production |
| 7 | WhatsApp API tokens in env — no rotation mechanism | Low | ⚠️ Standard for cloud API tokens |
| 8 | No password complexity enforcement beyond min length in Zod | Low | ⚠️ Should add pattern validation |
