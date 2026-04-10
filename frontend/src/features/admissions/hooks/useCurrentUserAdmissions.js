import { useQuery } from '@tanstack/react-query';
import { admissionsQueryKeys, getCurrentUserAdmissions } from '../api';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

export function useCurrentUserAdmissions() {
  const { isAuthenticated, user } = useAuthSession();
  const canAccessAccountAdmissions = user?.role === 'student' || user?.role === 'teacher';

  return useQuery({
    queryKey: admissionsQueryKeys.ownList(),
    queryFn: getCurrentUserAdmissions,
    enabled: isAuthenticated && canAccessAccountAdmissions,
  });
}
