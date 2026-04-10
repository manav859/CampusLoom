import api from '@/lib/api';

/**
 * Teacher Dashboard API Endpoints
 */

export const teacherApi = {
  // Attendance
  markAttendance: async (payload) => {
    const { data } = await api.post('/attendance', payload);
    return data;
  },
  getClassAttendance: async (params) => {
    const { data } = await api.get('/attendance/class', { params });
    return data;
  },

  // Study Material (Uses FormData for file upload)
  uploadStudyMaterial: async (formData) => {
    const { data } = await api.post('/study-material', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  deleteStudyMaterial: async (id) => {
    const { data } = await api.delete(`/study-material/${id}`);
    return data;
  },

  // Lectures
  createLecture: async (payload) => {
    const { data } = await api.post('/lectures', payload);
    return data;
  },
  deleteLecture: async (id) => {
    const { data } = await api.delete(`/lectures/${id}`);
    return data;
  },

  // Tests & Results
  createTest: async (payload) => {
    const { data } = await api.post('/tests', payload);
    return data;
  },
  submitTestResults: async (payload) => {
    const { data } = await api.post('/tests/submit-results', payload);
    return data;
  },
  getTestsByClass: async (params) => {
    const { data } = await api.get('/tests', { params });
    return data;
  },
  getTestDetails: async (id) => {
    const { data } = await api.get(`/tests/${id}`);
    return data;
  },

  // Timetable
  getMyTimetable: async () => {
    const { data } = await api.get('/timetable/my');
    return data;
  },

  // Chat
  getChatHistory: async (userId) => {
    const { data } = await api.get(`/chat/${userId}`);
    return data;
  },
  sendMessage: async (payload) => {
    const { data } = await api.post('/chat', payload);
    return data;
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    const { data } = await api.get('/dashboard/teacher');
    return data;
  }
};
