import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { admissionsQueryKeys, getAdminAdmissionById } from '../api';

export function useAdminAdmission(admissionId) {
  const { isAuthenticated } = useAuthSession();

  return useQuery({
    queryKey: admissionsQueryKeys.adminDetail(admissionId),
    queryFn: () => getAdminAdmissionById(admissionId),
    enabled: isAuthenticated && Boolean(admissionId),
  });
}
