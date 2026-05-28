# Environment Variables List (Keys Only)

#### Backend (`backend/.env`)

| Key | Required | Purpose |
|-----|----------|---------|
| `NODE_ENV` | No (default: development) | Runtime environment |
| `PORT` | No (default: 4000) | Server port |
| `DATABASE_URL` | **Yes** | PostgreSQL pooled connection (Neon) |
| `DIRECT_URL` | No | PostgreSQL direct connection for migrations |
| `MASTER_DATABASE_URL` | No | Master DB for multi-tenant |
| `NEON_API_KEY` | No | Neon API for DB provisioning |
| `NEON_PROJECT_ID` | No | Neon project identifier |
| `NEON_BRANCH_ID` | No | Neon branch identifier |
| `NEON_ROLE_NAME` | No | Neon DB owner role |
| `NEON_DATABASE_URL_TEMPLATE` | No | Template for tenant DB URLs |
| `NEON_DIRECT_URL_TEMPLATE` | No | Template for tenant direct URLs |
| `SUPER_ADMIN_EMAIL` | No | Platform admin email |
| `SUPER_ADMIN_PASSWORD` | No | Platform admin password (plaintext) |
| `SUPER_ADMIN_PASSWORD_HASH` | No | Platform admin password (bcrypt) |
| `JWT_ACCESS_SECRET` | **Yes** (min 24 chars) | Access token signing secret |
| `JWT_REFRESH_SECRET` | **Yes** (min 24 chars) | Refresh token signing secret |
| `ACCESS_TOKEN_EXPIRES_IN` | No (default: 15m) | Access token TTL |
| `REFRESH_TOKEN_EXPIRES_IN` | No (default: 7d) | Refresh token TTL |
| `FRONTEND_URL` | No (default: http://localhost:3000) | Frontend origin |
| `CORS_ORIGIN` | No (default: http://localhost:3000) | Allowed CORS origins (comma-separated) |
| `LOG_LEVEL` | No (default: info) | Pino log level |
| `PRISMA_LOG_LEVEL` | No (default: error,warn) | Prisma query logging |
| `DEMO_RESET_ENABLED` | No (default: false) | Enable demo data reset endpoint |
| `WHATSAPP_ACCESS_TOKEN` | No | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | No | WhatsApp business phone ID |
| `WHATSAPP_VERIFY_TOKEN` | No | WhatsApp webhook verify token |
| `REDIS_URL` | No | Redis for notification queue |
| `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` | No | Workaround for Render deploy locks |

#### Frontend (`frontend/.env.local`)

| Key | Required | Purpose |
|-----|----------|---------|
| `NEXT_PUBLIC_API_URL` | No (default: http://localhost:4000/api) | Backend API base URL |
| `NEXT_PUBLIC_API_BASE_URL` | No | Alias for API URL |
| `NEXT_PUBLIC_APP_NAME` | No (default: SmartShala) | Application name |
