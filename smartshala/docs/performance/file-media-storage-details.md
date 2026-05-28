# File / Media Storage Details

| Storage Type | Location | Details |
|-------------|----------|---------|
| Student documents | `backend/uploads/student-documents/` | Local filesystem |
| School logos | ⚠️ *URL-based reference in DB* | `logoUrl` field on School model |
| Student photos | ⚠️ *URL-based reference in DB* | `profilePhotoUrl` field on Student model |
| Upload limits | Multer default + `express.json({ limit: "1mb" })` | 1MB JSON, Multer default for files |
| Accepted types | PDF, JPG, PNG | Validated on frontend ("PDF, JPG, PNG up to 5MB") |

> ⚠️ **Critical for production**: Local file storage is **ephemeral on Render**. Files will be lost on redeploy. Migrate to S3/GCS/Cloudflare R2.
