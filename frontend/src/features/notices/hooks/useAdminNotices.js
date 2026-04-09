import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { getAdminNotices, noticesQueryKeys } from '../api';

export function useAdminNotices() {
  const { isAuthenticated } = useAuthSession();

  return useQuery({
    queryKey: noticesQueryKeys.adminList(),
    queryFn: getAdminNotices,
    enabled: isAuthenticated,
  });
}
