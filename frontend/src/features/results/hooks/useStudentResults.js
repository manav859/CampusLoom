import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { resultsQueryKeys, getStudentResults } from '../api';

export function useStudentResults(studentId) {
  const { isAuthenticated } = useAuthSession();

  return useQuery({
    queryKey: resultsQueryKeys.studentResults(studentId),
    queryFn: () => getStudentResults(studentId),
    enabled: isAuthenticated && !!studentId,
  });
}
