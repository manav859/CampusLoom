import { Bell, FileText, GraduationCap, Settings, Users } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import AdminFeaturePage from '@/pages/admin/AdminFeaturePage';
import DashboardPage from '@/pages/admin/DashboardPage';

const adminRoutes = [
  {
    index: true,
    element: <DashboardPage />,
  },
  {
    path: 'admissions',
    element: (
      <AdminFeaturePage
        title="Admissions"
        description="Feature not available yet. Admission workflows will appear here once the backend module is ready for admin consumption."
        icon={GraduationCap}
      />
    ),
  },
  {
    path: 'users',
    element: (
      <AdminFeaturePage
        title="Users"
        description="Feature not available yet. User management UI will be enabled once the supporting admin workflows are finalized."
        icon={Users}
      />
    ),
  },
  {
    path: 'pages',
    element: (
      <AdminFeaturePage
        title="Pages"
        description="Feature not available yet. CMS page management will be connected here once the admin editor flow is complete."
        icon={FileText}
      />
    ),
  },
  {
    path: 'notices',
    element: (
      <AdminFeaturePage
        title="Notices"
        description="Feature not available yet. Notice publishing tools will appear here after the module is fully wired to the admin API."
        icon={Bell}
      />
    ),
  },
  {
    path: 'settings',
    element: (
      <AdminFeaturePage
        title="Settings"
        description="Feature not available yet. Configuration controls will appear here when the settings module exposes stable admin endpoints."
        icon={Settings}
      />
    ),
  },
  {
    path: '*',
    element: <Navigate to="/admin" replace />,
  },
];

export default adminRoutes;
