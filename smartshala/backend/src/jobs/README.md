# Jobs

SmartShala V1 sends WhatsApp work asynchronously. The current implementation logs and dispatches in-process so local development is simple.

Production path:

1. Add Redis using `REDIS_URL`.
2. Move notification dispatch into a BullMQ worker.
3. Keep API requests limited to writing `notifications` rows and enqueueing job IDs.

