# API Contract

This document acts as the single source of truth for frontend integration with the CampusLoom backend.

## Global Conventions

- **Base Path**: `/api/v1`
- **Authentication**: JWT via tokens (planned; currently no auth logic is enforced).
- **Format**: All payloads should be `application/json`.
- **CORS**: Verified; headers ensure cross-origin requests from the frontend pass successfully.

## Standard Envelopes

Every response from the backend follows one of the two formats below. Do not rely solely on HTTP status codes; parse the JSON payload for reliable feedback.

### Success Envelope
```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": { ... } // Optional payload varying by route
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Human-readable reason for failure",
  "errors": [ ... ] // Optional details (e.g. Zod validation failure points)
}
```

---

## Live Routes

### Health Check 

- **Method**: `GET`
- **Path**: `/api/v1/health`
- **Purpose**: Verify backend uptime and connectivity.
- **Auth Required**: `No`
- **Response**:
  ```json
  {
    "success": true,
    "message": "CampusLoom API running",
    "data": {
      "uptime": 12.435,
      "timestamp": "2026-04-07T14:30:10.123Z"
    }
  }
  ```

---

## Planned API Domains

*(Modules exist in code but route-handlers inside them are empty pending implementation).*

- `/api/v1/auth/*`
- `/api/v1/users/*`
- `/api/v1/pages/*`
- `/api/v1/media/*`
- `/api/v1/notices/*`
- `/api/v1/events/*`
- `/api/v1/admissions/*`
- `/api/v1/faculty/*`
- `/api/v1/gallery/*`
- `/api/v1/results/*`
- `/api/v1/dashboard/*`
- `/api/v1/audit-logs/*`
- `/api/v1/settings/*`
