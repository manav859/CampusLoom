import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createResult, resultsQueryKeys } from '../api';

export function useCreateResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createResult,
    onSuccess: (data) => {
      // Invalidate the specific student's results cache
      if (data?.studentId) {
        queryClient.invalidateQueries({
          queryKey: resultsQueryKeys.studentResults(data.studentId),
        });
      }
    },
  });
}
