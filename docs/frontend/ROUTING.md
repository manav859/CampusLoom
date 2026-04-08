# Routing Architecture

CampusLoom uses React Router v7 with `createBrowserRouter` for layout-based routing and route-level crash containment.

## Route Hierarchy

```text
/                        -> PublicLayout
|-- /                    -> HomePage
|-- /about               -> AboutPage
|-- /admissions          -> AdmissionsPage
|-- /contact             -> ContactPage
|-- /unauthorized        -> UnauthorizedPage
`-- *                    -> NotFoundPage

/login                   -> AuthLayout -> LoginPage
/register                -> AuthLayout -> RegisterPage

/admin                   -> ProtectedRoute -> AdminLayout
|-- /admin               -> DashboardPage
|-- /admin/admissions    -> Stable placeholder page
|-- /admin/users         -> Stable placeholder page
|-- /admin/pages         -> Stable placeholder page
|-- /admin/notices       -> Stable placeholder page
|-- /admin/settings      -> Stable placeholder page
`-- /admin/*             -> Redirects to /admin
```

## Layout System

### PublicLayout

- Sticky navigation
- Responsive mobile drawer
- Footer shell for public content

### AdminLayout

- Protected admin shell
- Collapsible desktop sidebar
- Mobile overlay sidebar
- Safe container for placeholder admin modules

### AuthLayout

- Minimal authentication shell
- Used for login and registration routes

## Route Safety

- Every admin route lives under a single `ProtectedRoute`
- Admin route rendering is guarded by `RouteErrorBoundary`
- Unknown admin routes redirect to `/admin`
- Unknown public routes render `NotFoundPage`
- Route-level exceptions degrade into controlled UI instead of crashing the app

## Adding New Routes

### Public Route

1. Create `src/pages/public/NewPage.jsx`
2. Add `{ path: 'new-page', element: <NewPage /> }` to `src/routes/publicRoutes.jsx`

### Admin Route

1. Create `src/pages/admin/NewAdminPage.jsx`
2. Add `{ path: 'new-section', element: <NewAdminPage /> }` to `src/routes/adminRoutes.jsx`
3. Add the sidebar link in `src/components/layouts/AdminLayout.jsx`

The parent admin route already enforces authentication and role checks, so child admin routes should not create their own divergent protection logic unless a narrower role rule is required.
