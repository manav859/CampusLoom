import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { dashboardQueryKeys, getDashboardStats } from '../api';

export function useDashboardStats() {
  const { isAuthenticated } = useAuthSession();

  return useQuery({
    queryKey: dashboardQueryKeys.stats(),
    queryFn: getDashboardStats,
    enabled: isAuthenticated,
    retry: false,
  });
}
