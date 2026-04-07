import { createBrowserRouter } from 'react-router-dom';
import PublicLayout from '@/components/layouts/PublicLayout';
import AdminLayout from '@/components/layouts/AdminLayout';
import AuthLayout from '@/components/layouts/AuthLayout';
import publicRoutes from './publicRoutes';
import adminRoutes from './adminRoutes';
import LoginPage from '@/pages/admin/LoginPage';

/**
 * Application router configuration.
 *
 * Structure:
 * ├── / (PublicLayout)
 * │   ├── /          → HomePage
 * │   ├── /about     → AboutPage
 * │   ├── /admissions → AdmissionsPage
 * │   └── /contact   → ContactPage
 * ├── /login (AuthLayout)
 * │   └── /login     → LoginPage
 * └── /admin (AdminLayout)
 *     └── /admin     → DashboardPage (ProtectedRoute)
 */
const router = createBrowserRouter([
  // ─── Public routes ───
  {
    element: <PublicLayout />,
    children: publicRoutes,
  },

  // ─── Auth routes (minimal layout) ───
  {
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
    ],
  },

  // ─── Admin routes (sidebar layout, protected) ───
  {
    path: 'admin',
    element: <AdminLayout />,
    children: adminRoutes,
  },
]);

export default router;
