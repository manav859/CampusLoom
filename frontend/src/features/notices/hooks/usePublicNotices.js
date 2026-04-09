import { useQuery } from '@tanstack/react-query';
import { getPublicNotices, noticesQueryKeys } from '../api';

export function usePublicNotices() {
  return useQuery({
    queryKey: noticesQueryKeys.publicList(),
    queryFn: getPublicNotices,
  });
}
