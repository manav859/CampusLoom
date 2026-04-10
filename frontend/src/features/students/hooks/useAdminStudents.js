import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { studentsQueryKeys, getAdminStudents } from '../api';

export function useAdminStudents() {
  const { isAuthenticated } = useAuthSession();

  return useQuery({
    queryKey: studentsQueryKeys.adminList(),
    queryFn: getAdminStudents,
    enabled: isAuthenticated,
  });
}
