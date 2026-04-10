import api from '@/lib/api';

export const examTypeOptions = [
  { label: 'Midterm', value: 'midterm' },
  { label: 'Final', value: 'final' },
  { label: 'Unit Test', value: 'unit_test' },
  { label: 'Practical', value: 'practical' },
];

export const resultsQueryKeys = {
  all: ['results'],
  studentResults: (studentId) => [...resultsQueryKeys.all, 'student', studentId],
  ownResults: () => [...resultsQueryKeys.all, 'account', 'own'],
};

export async function createResult(payload) {
  const response = await api.post('/results', payload);

  return response.data;
}

export async function getStudentResults(studentId) {
  const response = await api.get(`/results/${studentId}`, {
    strictErrorHandling: true,
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function getCurrentUserResults() {
  const response = await api.get('/user/results', {
    strictErrorHandling: true,
  });

  return Array.isArray(response.data) ? response.data : [];
}
