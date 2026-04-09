import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createNotice,
  deleteNotice,
  noticesQueryKeys,
  updateNotice,
  updateNoticeStatus,
} from '../api';

async function invalidateNoticeQueries(queryClient, noticeId) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: noticesQueryKeys.adminList() }),
    queryClient.invalidateQueries({ queryKey: noticesQueryKeys.publicList() }),
  ];

  if (noticeId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: noticesQueryKeys.adminDetail(noticeId) }));
  }

  await Promise.all(invalidations);
}

export function useCreateNoticeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNotice,
    onSuccess: async (notice) => {
      await invalidateNoticeQueries(queryClient, notice?.id);
    },
  });
}

export function useUpdateNoticeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNotice,
    onSuccess: async (notice) => {
      await invalidateNoticeQueries(queryClient, notice?.id);
    },
  });
}

export function useDeleteNoticeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNotice,
    onSuccess: async (_, noticeId) => {
      queryClient.removeQueries({ queryKey: noticesQueryKeys.adminDetail(noticeId) });
      await invalidateNoticeQueries(queryClient);
    },
  });
}

export function useUpdateNoticeStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNoticeStatus,
    onSuccess: async (notice) => {
      await invalidateNoticeQueries(queryClient, notice?.id);
    },
  });
}
