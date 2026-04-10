import { studentApi } from '../api';

/**
 * Dashboard Hooks
 */
export function useStudentDashboard() {
  return useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: () => studentApi.getDashboardStats(),
  });
}

/**
 * Attendance Hooks
 */
export function useStudentAttendance(params) {
  return useQuery({
    queryKey: ['student', 'attendance', params],
    queryFn: () => studentApi.getMyAttendance(params),
  });
}

/**
 * Timetable Hooks
 */
export function useStudentTimetable() {
  return useQuery({
    queryKey: ['student', 'timetable'],
    queryFn: () => studentApi.getMyTimetable(),
  });
}

/**
 * Material & Lectures Hooks
 */
export function useStudentMaterials(params) {
  return useQuery({
    queryKey: ['student', 'materials', params],
    queryFn: () => studentApi.listStudyMaterial(params),
  });
}

export function useStudentLectures(params) {
  return useQuery({
    queryKey: ['student', 'lectures', params],
    queryFn: () => studentApi.listLectures(params),
  });
}

/**
 * Results Hooks
 */
export function useStudentResults() {
  return useQuery({
    queryKey: ['student', 'results'],
    queryFn: () => studentApi.getMyResults(),
  });
}

/**
 * Notification Hooks
 */
export function useStudentNotifications() {
  return useQuery({
    queryKey: ['student', 'notifications'],
    queryFn: () => studentApi.getMyNotifications(),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => studentApi.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'notifications'] });
    },
  });
}

/**
 * Chat Hooks
 */
export function useChatContacts() {
  return useQuery({
    queryKey: ['chat', 'contacts'],
    queryFn: () => studentApi.getChatContacts(),
  });
}

export function useChatHistory(userId) {
  return useQuery({
    queryKey: ['chat', userId],
    queryFn: () => studentApi.getChatHistory(userId),
    refetchInterval: 5000, // Poll every 5 seconds as requested
    enabled: !!userId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => studentApi.sendMessage(payload),
    onSuccess: (_, { receiverId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', receiverId] });
    },
  });
}
