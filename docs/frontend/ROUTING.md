# Routing Architecture

CampusLoom uses **React Router v7** with `createBrowserRouter` for type-safe, layout-based routing.

## Route Hierarchy

```
/                          → PublicLayout
├── /                      → HomePage (index)
├── /about                 → AboutPage
├── /admissions            → AdmissionsPage
└── /contact               → ContactPage

/login                     → AuthLayout
└── /login                 → LoginPage

/admin                     → AdminLayout
└── /admin                 → DashboardPage (ProtectedRoute)
    ├── /admin/admissions  → (future)
    ├── /admin/users       → (future)
    ├── /admin/pages       → (future)
    ├── /admin/notices     → (future)
    └── /admin/settings    → (future)
```

## Layout System

Three layout shells provide consistent navigation chrome:

### PublicLayout
- **Sticky navbar** with glassmorphism backdrop blur
- **Responsive mobile drawer** (hamburger menu)
- **Footer** with branding
- Used for all public-facing pages

### AdminLayout
- **Collapsible sidebar** with icon-only mode
- **Mobile sidebar overlay** with backdrop
- **Topbar** with breadcrumb navigation
- **Scrollable content area**
- Used for all admin panel pages

### AuthLayout
- **Minimal centered card** — no navbar or sidebar
- Clean auth experience for login/register flows
- Used exclusively for authentication pages

## Route Configuration

Routes are split into separate files for clean maintenance:

| File                   | Scope  | Description                            |
| ---------------------- | ------ | -------------------------------------- |
| `routes/index.jsx`     | Root   | Combines all route groups with layouts |
| `routes/publicRoutes.jsx` | Public | Public page route definitions       |
| `routes/adminRoutes.jsx`  | Admin  | Admin page routes with ProtectedRoute |

## Adding New Routes

### Public Route
1. Create page component in `src/pages/public/NewPage.jsx`
2. Add route to `src/routes/publicRoutes.jsx`:
   ```jsx
   { path: 'new-page', element: <NewPage /> }
   ```

### Admin Route (Protected)
1. Create page component in `src/pages/admin/NewAdminPage.jsx`
2. Add route to `src/routes/adminRoutes.jsx`:
   ```jsx
   {
     path: 'new-section',
     element: (
       <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
         <NewAdminPage />
       </ProtectedRoute>
     ),
   }
   ```
3. Add sidebar link in `AdminLayout.jsx` `SIDEBAR_LINKS` array.

## Protected Routes (Phase 2)

The `ProtectedRoute` component is a pass-through in Phase 1. In Phase 2:

```jsx
// Future implementation
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
}
```

## Scroll Behavior

React Router's `createBrowserRouter` handles scroll restoration by default. For explicit scroll-to-top on navigation, a `ScrollToTop` component can be added in Phase 2.
