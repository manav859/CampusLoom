import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { getAdminNoticeById, noticesQueryKeys } from '../api';

export function useAdminNotice(noticeId) {
  const { isAuthenticated } = useAuthSession();

  return useQuery({
    queryKey: noticesQueryKeys.adminDetail(noticeId),
    queryFn: () => getAdminNoticeById(noticeId),
    enabled: isAuthenticated && Boolean(noticeId),
  });
}
