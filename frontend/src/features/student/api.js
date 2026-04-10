import api from '@/lib/api';

/**
 * Student Dashboard API Endpoints
 */

export const studentApi = {
  // Attendance
  getMyAttendance: async (params) => {
    const { data } = await api.get('/attendance/my', { params });
    return data;
  },

  // Timetable
  getMyTimetable: async () => {
    const { data } = await api.get('/timetable/my');
    return data;
  },

  // Study Material & Lectures
  listStudyMaterial: async (params) => {
    const { data } = await api.get('/study-material', { params });
    return data;
  },
  listLectures: async (params) => {
    const { data } = await api.get('/lectures', { params });
    return data;
  },

  // Tests & Results (Interactive Class Tests)
  getMyResults: async () => {
    const { data } = await api.get('/tests/my');
    return data;
  },

  // Notifications
  getMyNotifications: async () => {
    const { data } = await api.get('/notifications/my');
    return data;
  },
  markNotificationAsRead: async (id) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data;
  },

  // Chat (History & Polling)
  getChatContacts: async () => {
    const { data } = await api.get('/chat/contacts');
    return data;
  },
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
    const { data } = await api.get('/dashboard/student');
    return data;
  }
};
