import ProtectedRoute from '@/components/common/ProtectedRoute';
import DashboardPage from '@/pages/admin/DashboardPage';

/**
 * Admin route definitions.
 * All wrapped in AdminLayout + ProtectedRoute (applied at the router level).
 *
 * Phase 2: ProtectedRoute will enforce JWT auth + RBAC role checks.
 * Add new admin sub-routes here as modules are built.
 */
const adminRoutes = [
  {
    index: true,
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  // Future routes:
  // { path: 'admissions', element: <ProtectedRoute><AdminAdmissionsPage /></ProtectedRoute> },
  // { path: 'users', element: <ProtectedRoute allowedRoles={['superadmin']}><AdminUsersPage /></ProtectedRoute> },
];

export default adminRoutes;
