import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client with production-ready defaults.
 *
 * - staleTime: 5 minutes — reduces unnecessary refetches
 * - gcTime: 10 minutes — garbage collect inactive queries
 * - retry: 1 — single retry on failure (prevent hammering API)
 * - refetchOnWindowFocus: false — better UX during development
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default queryClient;
