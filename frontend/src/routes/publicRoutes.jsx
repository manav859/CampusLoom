import HomePage from '@/pages/public/HomePage';
import AboutPage from '@/pages/public/AboutPage';
import AdmissionsPage from '@/pages/public/AdmissionsPage';
import ContactPage from '@/pages/public/ContactPage';
import NoticesPage from '@/pages/public/NoticesPage';

/**
 * Public route definitions.
 * All wrapped in PublicLayout (applied at the router level).
 */
const publicRoutes = [
  { index: true, element: <HomePage /> },
  { path: 'about', element: <AboutPage /> },
  { path: 'notices', element: <NoticesPage /> },
  { path: 'admissions', element: <AdmissionsPage /> },
  { path: 'contact', element: <ContactPage /> },
];

export default publicRoutes;
