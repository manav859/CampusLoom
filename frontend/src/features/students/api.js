import api from '@/lib/api';

export const studentsQueryKeys = {
  all: ['students'],
  adminList: () => [...studentsQueryKeys.all, 'admin', 'list'],
  adminDetail: (studentId) => [...studentsQueryKeys.all, 'admin', 'detail', studentId],
};

export async function getAdminStudents() {
  const response = await api.get('/students', {
    strictErrorHandling: true,
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function getAdminStudentById(studentId) {
  const response = await api.get(`/students/${studentId}`, {
    strictErrorHandling: true,
  });

  return response.data ?? null;
}

export async function deleteAdminStudent(studentId) {
  const response = await api.delete(`/students/${studentId}`);

  return response.data;
}
