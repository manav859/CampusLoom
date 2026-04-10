import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { resultsQueryKeys, getCurrentUserResults } from '../api';

export function useCurrentUserResults() {
  const { isAuthenticated, user } = useAuthSession();
  const canAccess = user?.role === 'student' || user?.role === 'teacher';

  return useQuery({
    queryKey: resultsQueryKeys.ownResults(),
    queryFn: getCurrentUserResults,
    enabled: isAuthenticated && canAccess,
  });
}
