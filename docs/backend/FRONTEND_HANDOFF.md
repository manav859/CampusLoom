# Frontend Handoff

Last Updated: 2026-04-08

## Integration Ready Right Now

1. Base URL: `http://localhost:5000/api/v1`
2. Auth: `POST /auth/login`, `POST /auth/register`, and `GET /auth/me` are available
3. Dashboard: `GET /dashboard/stats` is available for authenticated `ADMIN` users
4. CORS: frontend requests are allowed for the configured `CORS_ORIGIN`

## Still Stubbed

- `/users`
- `/admissions`
- `/notices`
- `/events`
- other module domains outside auth and dashboard

## Current Notes

- Dashboard non-user counts are derived from live MongoDB collections if those collections exist
- Authenticated dashboard access is enforced server-side
- Additional admin widgets can be added without changing the frontend API pattern
