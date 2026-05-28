# Known Risks & Open Issues

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **File storage is local** — lost on Render redeploy | HIGH | Migrate to S3/GCS immediately |
| 2 | **No CI/CD** — manual deploys risk regressions | MEDIUM | Add GitHub Actions |
| 3 | **Rate limiter is in-memory** — ineffective at scale | MEDIUM | Migrate to Redis |
| 4 | **JWT in localStorage** — XSS vulnerability | MEDIUM | Consider httpOnly cookies |
| 5 | **No automated test suite** — changes may break | MEDIUM | Add integration/E2E tests |
| 6 | **WhatsApp API is placeholder** — not production-verified | LOW | Verify with real Meta Business API credentials |
| 7 | **No backup/restore procedure** — relies on Neon PITR | LOW | Document and test restore procedure |
| 8 | **Single-region deployment** — no disaster recovery | LOW | Add multi-region when scale justifies |
