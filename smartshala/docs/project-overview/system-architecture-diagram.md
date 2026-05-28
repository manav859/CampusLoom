# System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                Next.js 15 / React 19 / Tailwind CSS             │
│                  Frontend: http://localhost:3000                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (JSON)
                           │ Bearer JWT Auth
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS BACKEND                           │
│                  Backend: http://localhost:4000                  │
│                                                                 │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Helmet  │ │   CORS   │ │  Morgan  │ │  Pino HTTP Logger │   │
│  └─────────┘ └──────────┘ └──────────┘ └───────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              TENANT MIDDLEWARE (/:schoolId/api)           │   │
│  │  tenantResolver → prismaManager → AsyncLocalStorage      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MIDDLEWARE LAYER                             │   │
│  │  requireAuth → requireRole → validate (Zod) → rateLimit │   │
│  │  auditMutatingRequest → dbWarmup → errorHandler          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                20 API MODULE ROUTERS                      │   │
│  │  auth, students, classes, attendance, fees, homework,     │   │
│  │  marks, dashboard, analytics, reports, settings,          │   │
│  │  notifications, communication, whatsapp, users, demo,     │   │
│  │  activity-logs, onboarding, super-admin, tenant-setup     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            BACKGROUND WORKERS (setInterval)               │   │
│  │  trialExpiryWorker (1hr) │ databaseDeletionWorker (1hr)  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Prisma ORM
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEON POSTGRESQL (Cloud)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │  master_db   │  │ school_AB12CD34  │  │ school_XYZ91KLM │   │
│  │  (Platform)  │  │   (Tenant 1)     │  │   (Tenant 2)    │   │
│  └──────────────┘  └──────────────────┘  └─────────────────┘   │
│                                                                 │
│  master_db: Schools, Coupons, OnboardingLogs, PasswordResets    │
│  school_*:  Users, Students, Classes, Attendance, Fees, etc.    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│             EXTERNAL SERVICES (Placeholder/Mock)                │
│                                                                 │
│  WhatsApp Cloud API (templated messages)                        │
│  Redis (queued, not required — placeholder)                     │
│  Neon API (database provisioning via REST)                      │
└─────────────────────────────────────────────────────────────────┘
```

**Architecture Pattern**: Database-per-tenant multi-tenancy with path-based routing (`/:schoolId/api/...`). Each tenant school gets an isolated PostgreSQL database on Neon. Tenant context is injected via Node.js `AsyncLocalStorage` per request.
