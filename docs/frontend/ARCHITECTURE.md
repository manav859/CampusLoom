# Frontend Architecture

CampusLoom frontend follows a **scalable modular architecture** designed for a production-grade multi-tenant SaaS.

## Design Principles

1. **Separation of Concerns**: UI components, business logic, API calls, and routing are in distinct layers.
2. **Feature-Based Growth**: The `features/` directory supports vertical slicing — each feature module contains its own components, hooks, and services.
3. **Reusable Primitives**: shadcn/ui provides consistent UI primitives. Common components layer on top for app-specific patterns.
4. **No Business Logic in UI**: Pages are thin orchestration layers. Data fetching and mutations go through React Query hooks.
5. **Typed API Layer**: Centralized Axios instance with standard envelope handling matching the backend contract.

## Folder Structure

```
frontend/
├── public/                  # Static assets served at root
├── src/
│   ├── app/                 # (reserved) App-level concerns
│   ├── assets/              # Images, fonts, SVGs
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives (Button, Input, Card)
│   │   ├── common/          # Shared composed components (Logo, Spinner, ProtectedRoute)
│   │   └── layouts/         # Layout shells (PublicLayout, AdminLayout, AuthLayout)
│   ├── features/            # Feature modules (future: auth, admissions, etc.)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities and configurations
│   │   ├── api.js           # Axios instance (centralized HTTP client)
│   │   ├── queryClient.js   # React Query client configuration
│   │   └── utils.js         # cn() helper (clsx + tailwind-merge)
│   ├── pages/
│   │   ├── public/          # Public-facing pages
│   │   └── admin/           # Admin panel pages
│   ├── routes/              # Route definitions
│   │   ├── index.jsx        # Root router configuration
│   │   ├── publicRoutes.jsx # Public route array
│   │   └── adminRoutes.jsx  # Admin route array (RBAC-ready)
│   ├── styles/
│   │   └── index.css        # Global styles + Tailwind + design tokens
│   └── main.jsx             # Application entry point
├── .env.example             # Environment variable template
├── index.html               # HTML shell with SEO meta tags
├── vite.config.js           # Vite configuration
├── jsconfig.json            # Path alias (@/) for imports
└── package.json
```

## Folder Responsibilities

| Folder              | Responsibility                                                 |
| ------------------- | -------------------------------------------------------------- |
| `components/ui/`    | shadcn/ui primitives — DO NOT add custom business logic here   |
| `components/common/`| Shared composed components used across multiple pages          |
| `components/layouts/`| Layout shells that wrap pages with navigation chrome           |
| `features/`         | Feature-specific modules with self-contained logic             |
| `hooks/`            | Custom React hooks (useAuth, useDebounce, etc.)                |
| `lib/`              | Pure utilities and configuration — no React components         |
| `pages/`            | Page-level components — thin orchestrators of features/data    |
| `routes/`           | Route definitions — separated by access scope (public/admin)   |
| `styles/`           | Global CSS, design tokens, and Tailwind customization          |

## Adding a New Feature Module

When adding a new feature (e.g., "Attendance"):

```
src/features/attendance/
├── components/         # Feature-specific UI components
├── hooks/              # Feature-specific hooks (useAttendance, etc.)
├── services/           # API service functions (getAttendance, markAttendance)
└── constants.js        # Feature-specific constants
```

Then add routes in `src/routes/adminRoutes.jsx` and pages in `src/pages/admin/`.

## Provider Architecture

```
StrictMode
  └── QueryClientProvider (React Query)
        └── RouterProvider (React Router)
              └── Layout (Public/Admin/Auth)
                    └── Page Component
```

Future providers to add (Phase 2+):
- `AuthProvider` — user session and role context
- `ThemeProvider` — dark mode toggle
- `ToastProvider` — notification system
