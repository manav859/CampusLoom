# Folder Structure Document

```
smartshala/
├── .agents/                          # AI agent skills & configuration
│   └── skills/                       # Caveman, cavecrew skills
├── .gitignore
├── .antigravityignore
├── package.json                      # Root monorepo scripts
├── README.md
├── AUDIT_CHANGES.md                  # 553-line audit remediation checklist
├── smartshala_v1_checklist.md         # V1 completion checklist (5 phases)
├── sample-students-import.csv        # Sample CSV for bulk import
│
├── backend/
│   ├── package.json                  # Backend dependencies & scripts
│   ├── tsconfig.json                 # TypeScript config (ES2022, NodeNext)
│   ├── .env.example                  # Environment template
│   ├── prisma/
│   │   ├── schema.prisma             # Tenant DB schema (766 lines, 23 models)
│   │   ├── seed.ts                   # Seed data script (392 lines)
│   │   ├── seed-april-attendance.ts  # April attendance seed
│   │   ├── master/
│   │   │   └── schema.prisma         # Master DB schema (4 models)
│   │   └── migrations/              # 29 migration directories
│   ├── scripts/
│   │   ├── render-start.mjs          # Production start (migrate + start)
│   │   └── register-existing-school.mjs  # Legacy tenant registration
│   ├── src/
│   │   ├── app.ts                    # Express app factory
│   │   ├── server.ts                 # Server bootstrap & shutdown
│   │   ├── config/
│   │   │   ├── env.ts                # Zod-validated environment config
│   │   │   └── logger.ts             # Pino logger setup
│   │   ├── core/
│   │   │   ├── asyncHandler.ts       # Async error wrapper
│   │   │   ├── auditLog.ts           # Audit log helper
│   │   │   ├── errors.ts             # AppError class
│   │   │   ├── grading.ts            # Grade band calculation
│   │   │   ├── pagination.ts         # Pagination helper
│   │   │   ├── prisma.ts             # Prisma client (tenant-aware)
│   │   │   └── studentAttendance.ts  # Single-source attendance calculator
│   │   ├── middleware/
│   │   │   ├── auth.ts               # requireAuth, requireRole
│   │   │   ├── activityAudit.ts      # Auto-audit mutating requests
│   │   │   ├── dbWarmup.ts           # Cold-start DB connection warmup
│   │   │   ├── errorHandler.ts       # Centralized error handling
│   │   │   ├── notFound.ts           # 404 handler
│   │   │   ├── rateLimit.ts          # In-memory rate limiter
│   │   │   ├── tenant.middleware.ts  # Multi-tenant resolver + AsyncLocalStorage
│   │   │   └── validate.ts           # Zod request validation
│   │   ├── modules/                  # 20 feature modules
│   │   │   ├── activity/             # (routes, controller, service)
│   │   │   ├── analytics/
│   │   │   ├── attendance/           # (+ report controller/service, schemas)
│   │   │   ├── auth/                 # (+ schemas)
│   │   │   ├── classes/              # (+ schemas)
│   │   │   ├── communication/        # (+ schemas)
│   │   │   ├── dashboard/
│   │   │   ├── demo/
│   │   │   ├── fees/                 # (+ schemas, receipt-pdf.ts)
│   │   │   ├── homework/             # (+ schemas)
│   │   │   ├── marks/                # (+ schemas)
│   │   │   ├── notifications/        # (+ schemas, whatsapp.service.ts)
│   │   │   ├── onboarding/           # (+ schemas)
│   │   │   ├── reports/
│   │   │   ├── settings/             # (+ schemas)
│   │   │   ├── students/             # (+ schemas)
│   │   │   ├── superAdmin/           # (+ middleware, schemas)
│   │   │   ├── tenantSetup/          # (+ schemas)
│   │   │   ├── users/                # (+ schemas)
│   │   │   └── whatsapp/
│   │   ├── routes/
│   │   │   ├── index.ts              # Central router registration
│   │   │   └── health.ts             # Health check endpoints
│   │   ├── services/
│   │   │   ├── createSchoolDatabase.ts  # Neon DB provisioning
│   │   │   ├── databaseDeletion.service.ts  # Tenant DB deletion
│   │   │   ├── trial.service.ts      # Trial expiry worker
│   │   │   ├── coupon.service.ts     # Coupon validation
│   │   │   └── payment.service.ts    # Payment helpers
│   │   ├── tenant/
│   │   │   ├── tenantContext.ts       # AsyncLocalStorage for tenant
│   │   │   ├── tenantResolver.ts      # Resolves schoolId to DB URL
│   │   │   ├── prismaManager.ts       # Tenant Prisma client pool
│   │   │   └── legacyTenant.ts        # Legacy single-tenant compat
│   │   ├── master-db/
│   │   │   └── masterPrisma.ts        # Master DB Prisma client
│   │   ├── lib/                       # (internal utilities)
│   │   ├── types/                     # TypeScript type extensions
│   │   ├── utils/
│   │   │   └── generateSchoolId.ts    # 8-char school ID generator
│   │   └── generated/                 # Prisma generated client (gitignored)
│   ├── tests/                        # Test files (5 test suites)
│   ├── uploads/
│   │   └── student-documents/         # File upload storage
│   └── dist/                          # Compiled JS output
│
├── frontend/
│   ├── package.json                  # Frontend dependencies & scripts
│   ├── tsconfig.json
│   ├── next.config.ts                # Next.js config (strict mode, unsplash images)
│   ├── tailwind.config.ts            # Apple-inspired design tokens
│   ├── postcss.config.js
│   ├── .env.example
│   ├── public/                       # Static assets
│   └── src/
│       ├── middleware.ts             # Next.js middleware (tenant URL rewriting)
│       ├── app/
│       │   ├── globals.css           # Global CSS (12KB design system)
│       │   ├── layout.tsx            # Root layout
│       │   ├── page.tsx              # Root redirect
│       │   ├── (auth)/login/         # Login page
│       │   ├── (app)/                # Authenticated app shell
│       │   │   ├── layout.tsx        # App layout (sidebar + auth guard)
│       │   │   ├── dashboard/        # Principal/teacher dashboard
│       │   │   ├── students/         # Student list, detail, create, edit
│       │   │   ├── teachers/         # Teacher list, create, edit
│       │   │   ├── classes/          # Class grid
│       │   │   ├── attendance/       # Attendance marking & reports
│       │   │   ├── fees/             # Fee dashboard, ledger, defaulters
│       │   │   ├── notifications/    # WhatsApp logs
│       │   │   ├── analytics/        # Risk insights
│       │   │   ├── reports/          # Reports page
│       │   │   ├── settings/         # School settings
│       │   │   ├── activity-logs/    # Audit log viewer
│       │   │   └── teacher/          # Teacher-specific pages
│       │   │       ├── classes/      # My Classes
│       │   │       ├── homework/     # Homework management
│       │   │       ├── marks/        # Exam & marks entry
│       │   │       └── communication/# Parent communication
│       │   ├── [schoolId]/           # Multi-tenant routes
│       │   │   ├── login/            # Tenant login
│       │   │   ├── receipt/          # Receipt view
│       │   │   ├── school-not-found/ # 404 for invalid school
│       │   │   └── subscription-expired/
│       │   ├── onboard/              # Onboarding page
│       │   ├── onboarding-success/
│       │   ├── trial-activated/
│       │   ├── payment-pending/
│       │   ├── school-inactive/
│       │   ├── super-admin/          # Super admin panel
│       │   └── receipt/              # Public receipt view
│       ├── components/
│       │   ├── layout/               # Sidebar, AuthGuard, etc.
│       │   ├── ui/                   # StatusPill, reusable UI components
│       │   ├── dashboard/            # Dashboard-specific components
│       │   ├── fees/                 # Fee-specific components
│       │   ├── AttendanceList.tsx
│       │   ├── AttendanceSummary.tsx
│       │   └── StudentRow.tsx
│       ├── features/
│       │   ├── attendance/           # Attendance feature logic
│       │   ├── auth/                 # Auth feature logic
│       │   ├── dashboard/            # Dashboard feature logic
│       │   └── reports/              # Reports feature logic
│       ├── hooks/
│       │   └── useAttendance.ts      # Attendance state management hook
│       ├── lib/
│       │   ├── api.ts                # API client (1213 lines, 50+ endpoints)
│       │   ├── env.ts                # Environment config
│       │   ├── tenant.ts             # Tenant URL helpers
│       │   ├── formatters.ts         # INR currency, date formatting
│       │   ├── communicationTemplates.ts  # WhatsApp message templates
│       │   └── prefetchCache.ts      # Client-side data prefetching
│       └── types/
│           └── index.ts              # SessionUser, Role, Kpi types
│
└── docs/
    ├── api/
    │   └── api-plan.md               # API endpoint reference
    ├── architecture/
    │   ├── system-overview.md         # System architecture overview
    │   └── multi-tenant-onboarding.md # Multi-tenant design doc
    ├── database/
    │   ├── schema-notes.md            # Schema design notes
    │   └── neon-migration.md          # Neon migration guide
    ├── product/
    │   └── v1-scope.md                # V1 scope document
    └── setup/
        └── local-development.md       # Local dev setup guide
```
