import { createBrowserRouter } from 'react-router-dom';
import PublicLayout from '@/components/layouts/PublicLayout';
import AdminLayout from '@/components/layouts/AdminLayout';
import AuthLayout from '@/components/layouts/AuthLayout';
import StudentLayout from '@/components/layouts/StudentLayout';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import RouteErrorBoundary from '@/components/common/RouteErrorBoundary';
import publicRoutes from './publicRoutes';
import adminRoutes from './adminRoutes';
import studentRoutes from './studentRoutes';
import LoginPage from '@/pages/admin/LoginPage';
import RegisterPage from '@/pages/admin/RegisterPage';
import NotFoundPage from '@/pages/public/NotFoundPage';
import UnauthorizedPage from '@/pages/public/UnauthorizedPage';

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      ...publicRoutes,
      { path: 'unauthorized', element: <UnauthorizedPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  {
    path: 'account',
    element: (
      <ProtectedRoute allowedRoles={['student', 'teacher']}>
        <StudentLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: studentRoutes,
  },
  {
    path: 'admin',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: adminRoutes,
  },
]);

export default router;
