# S3 Document Storage Setup

Student documents are stored in a private S3 bucket. The backend uploads with a
private object ACL and serves downloads via short-lived (15 min) presigned URLs.
The auth check stays in front of every download — a presigned URL is only
generated after the request passes role authorization.

If `S3_BUCKET` is unset, the app falls back to local disk (`uploads/`), which is
intended for local development only. On Render the disk is ephemeral and is
wiped on every redeploy, so production **must** set the S3 variables.

## Bucket + IAM checklist

Create and configure the bucket BEFORE deploying:

- [ ] Create bucket: `smartshala-documents` (region `ap-south-1`)
- [ ] Block ALL public access (all four checkboxes ON)
- [ ] Enable server-side encryption: SSE-S3 (AES256)
- [ ] Enable versioning (protects against accidental deletes)
- [ ] Set lifecycle policy: transition to Glacier after 365 days
- [ ] Create IAM user: `smartshala-app` (programmatic access only)
- [ ] Attach inline IAM policy (least privilege):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::smartshala-documents/*"
    }
  ]
}
```

- [ ] Generate access keys for the IAM user
- [ ] Add to Render environment: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_KEY`
- [ ] Do NOT add S3 keys to `.env` files or Git

## Environment variables

| Variable            | Required | Default              | Notes                                           |
| ------------------- | -------- | -------------------- | ----------------------------------------------- |
| `S3_BUCKET`         | prod     | —                    | Unset → local-disk fallback (dev only)          |
| `S3_REGION`         | no       | `ap-south-1`         |                                                 |
| `S3_ACCESS_KEY_ID`  | prod     | —                    | IAM user access key                             |
| `S3_SECRET_KEY`     | prod     | —                    | IAM user secret key                             |
| `S3_ENDPOINT`       | no       | —                    | Only for S3-compatible providers (R2, MinIO)    |
| `S3_KEY_PREFIX`     | no       | `student-documents`  | Key prefix for uploaded objects                 |

## Object key layout

```
student-documents/<schoolId>/<studentId>/<uuid>-<sanitized-filename>
```

## S3-compatible providers (Cloudflare R2, MinIO)

Set `S3_ENDPOINT` to the provider endpoint. The client enables
`forcePathStyle` automatically when an endpoint is configured.
