import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import queryClient from '@/lib/queryClient';
import router from '@/routes';

/**
 * Application root component.
 *
 * Provides:
 * - React Query (server state management)
 * - React Router (routing / navigation)
 *
 * Future additions:
 * - AuthProvider (Phase 2)
 * - ThemeProvider (if dark mode toggle is needed)
 * - ToastProvider (notifications)
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
