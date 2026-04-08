# Pages CMS

This document defines the Day 3 CMS implementation for website pages in SchoolOS.

## Architecture

- Module path: `backend/src/modules/pages/`
- Runtime persistence: MongoDB via Mongoose
- Requested schema artifact: `backend/prisma/schema.prisma`
- Separation:
  - Admin management routes live under `/api/v1/pages/*`
  - Public delivery routes live under `/api/v1/public/pages/*`

The controller layer only parses input and formats responses. All business rules stay in `pages.service.js`.

## Content Structure

Page `content` is stored as a flexible JSON object. The backend does not hardcode any editor schema, so frontend sections such as hero banners, feature grids, testimonials, or CTA blocks can evolve without database changes.

Example shape:

```json
{
  "hero": {
    "headline": "Welcome to SchoolOS",
    "subheadline": "Modern school operations for ambitious institutions"
  },
  "sections": [
    {
      "type": "feature-grid",
      "items": [
        { "title": "Admissions", "description": "Digitized workflows" }
      ]
    }
  ]
}
```

## Slug System

- Slugs are sanitized to lowercase hyphen-case.
- Invalid characters are removed.
- Whitespace and repeated separators collapse to a single `-`.
- If a requested slug already exists, the service appends `-1`, `-2`, and so on until it finds a free value.
- If a slug is omitted on creation, the service derives it from the title.

This logic is centralized in `pages.service.js` to keep controllers thin and to guarantee consistent routing behavior.

## API Separation

### Admin APIs

Protected by `authenticate` and `authorizeRoles(['ADMIN'])`:

- `GET /api/v1/pages`
- `POST /api/v1/pages`
- `PUT /api/v1/pages/:id`
- `DELETE /api/v1/pages/:id`
- `PATCH /api/v1/pages/:id/status`

These endpoints return full CMS records including status, slug, timestamps, and SEO metadata.

### Public API

No authentication:

- `GET /api/v1/public/pages/:slug`

The public service only returns published pages and exposes:

- `title`
- `content`
- `seoTitle`
- `seoDescription`

Draft records are never returned from this path.

## Security Considerations

- All inputs are validated with Zod before service execution.
- Admin write routes require authentication and `ADMIN` role authorization.
- Public reads enforce `status: 'published'` at the database query level.
- Slugs are sanitized server-side even when the client provides them.
- Duplicate slug collisions are blocked both by service checks and the unique database index.
- The service uses Mongoose models only; no raw database queries are used for page CRUD.

## Scalability Notes

- Flexible JSON content avoids schema churn for future CMS blocks.
- Admin and public route trees are intentionally separated to support caching, CDN exposure, and future versioning without coupling to admin concerns.
- The current implementation is single-tenant in runtime behavior because tenant context is not yet propagated through auth. Day 4 should formalize `schoolId` ownership and tenant-aware page lookups.
