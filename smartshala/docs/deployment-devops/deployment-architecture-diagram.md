# Deployment Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                   RENDER.COM                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │        Backend Web Service                    │    │
│  │  Build: npm run prisma:generate:all && tsc    │    │
│  │  Start: node scripts/render-start.mjs         │    │
│  │    1. Deploy master DB migrations             │    │
│  │    2. Deploy tenant DB migrations (5 retries) │    │
│  │    3. Start node dist/server.js               │    │
│  └─────────────────┬────────────────────────────┘    │
│                    │                                  │
│  ┌─────────────────┴────────────────────────────┐    │
│  │        Frontend (presumed Vercel/Render)       │    │
│  │  Build: next build                            │    │
│  │  Start: next start                            │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│               NEON POSTGRESQL (Cloud)                 │
│   master_db + school_* tenant databases              │
│   Pooled connections (pgbouncer)                     │
│   Direct connections (for migrations)                │
└──────────────────────────────────────────────────────┘
```
