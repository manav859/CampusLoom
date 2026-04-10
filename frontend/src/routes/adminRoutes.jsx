import { Settings, Users } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import AdmissionDetailPage from '@/pages/admin/AdmissionDetailPage';
import AdmissionsPage from '@/pages/admin/AdmissionsPage';
import AdminFeaturePage from '@/pages/admin/AdminFeaturePage';
import DashboardPage from '@/pages/admin/DashboardPage';
import NoticeCreatePage from '@/pages/admin/NoticeCreatePage';
import NoticeEditPage from '@/pages/admin/NoticeEditPage';
import NoticesPage from '@/pages/admin/NoticesPage';
import StudentsPage from '@/pages/admin/StudentsPage';
import ResultsPage from '@/pages/admin/ResultsPage';

const adminRoutes = [
  {
    index: true,
    element: <DashboardPage />,
  },
  {
    path: 'admissions',
    element: <AdmissionsPage />,
  },
  {
    path: 'admissions/:id',
    element: <AdmissionDetailPage />,
  },
  {
    path: 'students',
    element: <StudentsPage />,
  },
  {
    path: 'results',
    element: <ResultsPage />,
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
    path: 'notices',
    element: <NoticesPage />,
  },
  {
    path: 'notices/new',
    element: <NoticeCreatePage />,
  },
  {
    path: 'notices/:id',
    element: <NoticeEditPage />,
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
