import { teacherApi } from '../api';

/**
 * Dashboard Hooks
 */
export function useTeacherDashboard() {
  return useQuery({
    queryKey: ['teacher', 'dashboard'],
    queryFn: () => teacherApi.getDashboardStats(),
  });
}

/**
 * Attendance Hooks
 */
export function useMarkAttendance() {
  return useMutation({
    mutationFn: (payload) => teacherApi.markAttendance(payload),
  });
}

export function useClassAttendance(params) {
  return useQuery({
    queryKey: ['teacher', 'attendance', params],
    queryFn: () => teacherApi.getClassAttendance(params),
    enabled: !!params?.class && !!params?.date,
  });
}

/**
 * Study Material Hooks
 */
export function useUploadMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData) => teacherApi.uploadStudyMaterial(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'materials'] }); // Re-use student key for listing
    },
  });
}

/**
 * Lectures Hooks
 */
export function useCreateLecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => teacherApi.createLecture(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'lectures'] });
    },
  });
}

export function useDeleteLecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => teacherApi.deleteLecture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'lectures'] });
    },
  });
}

/**
 * Tests Hooks
 */
export function useCreateTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => teacherApi.createTest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'tests'] });
    },
  });
}

export function useSubmitResults() {
  return useMutation({
    mutationFn: (payload) => teacherApi.submitTestResults(payload),
  });
}

export function useTeacherTests(params) {
  return useQuery({
    queryKey: ['teacher', 'tests', params],
    queryFn: () => teacherApi.getTestsByClass(params),
    enabled: !!params?.class,
  });
}

/**
 * Timetable Hooks
 */
export function useTeacherTimetable() {
  return useQuery({
    queryKey: ['teacher', 'timetable'],
    queryFn: () => teacherApi.getMyTimetable(),
  });
}

/**
 * Chat Hooks (Teacher perspective)
 */
export function useTeacherChatHistory(userId) {
  return useQuery({
    queryKey: ['chat', userId],
    queryFn: () => teacherApi.getChatHistory(userId),
    refetchInterval: 5000,
    enabled: !!userId,
  });
}

export function useTeacherSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => teacherApi.sendMessage(payload),
    onSuccess: (_, { receiverId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', receiverId] });
    },
  });
}
