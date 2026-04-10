import api from '@/lib/api';

export const admissionStatusOptions = [
  { label: 'New', value: 'new' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export const admissionsQueryKeys = {
  all: ['admissions'],
  adminList: () => [...admissionsQueryKeys.all, 'admin', 'list'],
  adminDetail: (admissionId) => [...admissionsQueryKeys.all, 'admin', 'detail', admissionId],
  ownList: () => [...admissionsQueryKeys.all, 'account', 'list'],
};

export async function createAdmissionInquiry(payload) {
  const response = await api.post('/admissions', payload);

  return response.data;
}

export async function getAdminAdmissions() {
  const response = await api.get('/admissions', {
    strictErrorHandling: true,
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function getAdminAdmissionById(admissionId) {
  const response = await api.get(`/admissions/${admissionId}`, {
    strictErrorHandling: true,
  });

  return response.data ?? null;
}

export async function updateAdminAdmissionStatus({ admissionId, status }) {
  const response = await api.patch(`/admissions/${admissionId}/status`, { status });

  return response.data;
}

export async function createAdminAdmissionNote({ admissionId, note }) {
  const response = await api.post(`/admissions/${admissionId}/notes`, { note });

  return response.data;
}

export async function getCurrentUserAdmissions() {
  const response = await api.get('/user/admissions', {
    strictErrorHandling: true,
  });

  return Array.isArray(response.data) ? response.data : [];
}
