# Master DB backup runbook

## Why this matters
The Master DB maps every school → its tenant database URL.
If lost, all school databases become unreachable (full outage).

## Schedule
Run daily via Render cron job or a separate cron service.
Recommended: 02:00 IST daily.

## Manual backup
```sh
cd backend
MASTER_DATABASE_URL=<value> npm run backup:master
```

## Restore procedure (tested quarterly)
```sh
psql $MASTER_DATABASE_URL < tmp-backups/master-db-<timestamp>.sql
```

## Retention
Keep 30 daily backups. Delete older files from S3:
```sh
aws s3 ls s3://your-bucket/backups/smartshala-master/ \
  | sort | head -n -30 \
  | awk '{print $4}' \
  | xargs -I{} aws s3 rm s3://your-bucket/backups/smartshala-master/{}
```

## Test restore checklist (run quarterly)
- [ ] Spin up a blank Postgres instance
- [ ] Run the restore command above
- [ ] Verify: `SELECT COUNT(*) FROM "School";` returns expected count
- [ ] Verify: `SELECT "schoolId", "dbUrl" FROM "School" LIMIT 3;`
- [ ] Document the restore date in this file
