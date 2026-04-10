# API Contract

This document is the frontend integration source of truth for the CampusLoom backend.

## Global Conventions

- Base path: `/api/v1`
- Format: `application/json`
- Authentication: JWT via `Authorization: Bearer <token>` for protected routes

## Standard Envelopes

### Success

```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "message": "Human-readable reason for failure",
  "errors": []
}
```

## Live Routes

### Health Check

- Method: `GET`
- Path: `/api/v1/health`
- Auth Required: `No`

### Register

- Method: `POST`
- Path: `/api/v1/auth/register`
- Auth Required: `No`

### Login

- Method: `POST`
- Path: `/api/v1/auth/login`
- Auth Required: `No`

### Current User

- Method: `GET`
- Path: `/api/v1/auth/me`
- Auth Required: `Yes`

### Dashboard Stats

- Method: `GET`
- Path: `/api/v1/dashboard/stats`
- Auth Required: `Yes (ADMIN)`

### Notices List

- Method: `GET`
- Path: `/api/v1/notices`
- Auth Required: `Yes (ADMIN)`

### Notice By Id

- Method: `GET`
- Path: `/api/v1/notices/:id`
- Auth Required: `Yes (ADMIN)`

### Create Notice

- Method: `POST`
- Path: `/api/v1/notices`
- Auth Required: `Yes (ADMIN)`

### Update Notice

- Method: `PUT`
- Path: `/api/v1/notices/:id`
- Auth Required: `Yes (ADMIN)`

### Delete Notice

- Method: `DELETE`
- Path: `/api/v1/notices/:id`
- Auth Required: `Yes (ADMIN)`

### Update Notice Status

- Method: `PATCH`
- Path: `/api/v1/notices/:id/status`
- Auth Required: `Yes (ADMIN)`

### Public Notices

- Method: `GET`
- Path: `/api/v1/public/notices`
- Auth Required: `No`

### Create Admission Inquiry

- Method: `POST`
- Path: `/api/v1/admissions`
- Auth Required: `No`

### Admissions List

- Method: `GET`
- Path: `/api/v1/admissions`
- Auth Required: `Yes (ADMIN)`

### Admission By Id

- Method: `GET`
- Path: `/api/v1/admissions/:id`
- Auth Required: `Yes (ADMIN)`

### Update Admission Status

- Method: `PATCH`
- Path: `/api/v1/admissions/:id/status`
- Auth Required: `Yes (ADMIN)`

### Add Admission Note

- Method: `POST`
- Path: `/api/v1/admissions/:id/notes`
- Auth Required: `Yes (ADMIN)`

### Pages List

- Method: `GET`
- Path: `/api/v1/pages`
- Auth Required: `Yes (ADMIN)`

### Create Page

- Method: `POST`
- Path: `/api/v1/pages`
- Auth Required: `Yes (ADMIN)`

### Update Page

- Method: `PUT`
- Path: `/api/v1/pages/:id`
- Auth Required: `Yes (ADMIN)`

### Delete Page

- Method: `DELETE`
- Path: `/api/v1/pages/:id`
- Auth Required: `Yes (ADMIN)`

### Update Page Status

- Method: `PATCH`
- Path: `/api/v1/pages/:id/status`
- Auth Required: `Yes (ADMIN)`

### Public Page By Slug

- Method: `GET`
- Path: `/api/v1/public/pages/:slug`
- Auth Required: `No`

## Planned or Stubbed Domains

- `/api/v1/users/*`
- `/api/v1/media/*`
- `/api/v1/events/*`
- `/api/v1/faculty/*`
- `/api/v1/gallery/*`
- `/api/v1/results/*`
- `/api/v1/audit-logs/*`
- `/api/v1/settings/*`
