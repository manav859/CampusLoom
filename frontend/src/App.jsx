import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import queryClient from '@/lib/queryClient';
import router from '@/routes';
import { AuthProvider } from '@/features/auth/AuthContext';

/**
 * Application root component.
 *
 * Provides:
 * - React Query (server state management)
 * - React Router (routing / navigation)
 * - AuthProvider (Application authentication bounds)
 *
 * Future additions:
 * - ThemeProvider (if dark mode toggle is needed)
 * - ToastProvider (notifications)
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
