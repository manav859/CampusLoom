import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client with production-ready defaults.
 *
 * - staleTime: 5 minutes - reduces unnecessary refetches
 * - gcTime: 10 minutes - garbage collect inactive queries
 * - retry: false - avoids retry storms against unavailable admin APIs
 * - refetchOnWindowFocus: false - better UX during development
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: false,
      throwOnError: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export default queryClient;
