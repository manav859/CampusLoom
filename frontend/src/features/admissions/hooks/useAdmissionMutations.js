import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  admissionsQueryKeys,
  createAdminAdmissionNote,
  createAdmissionInquiry,
  updateAdminAdmissionStatus,
} from '../api';

async function invalidateAdmissionQueries(queryClient, admissionId) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: admissionsQueryKeys.adminList() }),
    queryClient.invalidateQueries({ queryKey: admissionsQueryKeys.ownList() }),
  ];

  if (admissionId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: admissionsQueryKeys.adminDetail(admissionId) }));
  }

  await Promise.all(invalidations);
}

export function useCreateAdmissionInquiryMutation() {
  return useMutation({
    mutationFn: createAdmissionInquiry,
  });
}

export function useUpdateAdmissionStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminAdmissionStatus,
    onSuccess: async (response, variables) => {
      await invalidateAdmissionQueries(queryClient, response?.id ?? variables?.admissionId);
    },
  });
}

export function useCreateAdmissionNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminAdmissionNote,
    onSuccess: async (response, variables) => {
      await invalidateAdmissionQueries(queryClient, response?.admissionId ?? variables?.admissionId);
    },
  });
}
