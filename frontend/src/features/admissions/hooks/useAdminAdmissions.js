import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { admissionsQueryKeys, getAdminAdmissions } from '../api';

export function useAdminAdmissions() {
  const { isAuthenticated } = useAuthSession();

  return useQuery({
    queryKey: admissionsQueryKeys.adminList(),
    queryFn: getAdminAdmissions,
    enabled: isAuthenticated,
  });
}
