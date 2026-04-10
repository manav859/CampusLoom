import { sendError, sendSuccess } from '../../utils/response.js';
import { getStudentDashboardStats, getTeacherDashboardStats } from './dashboard.service.js';

export async function getStudentDashboardHandler(request, reply) {
  try {
    const stats = await getStudentDashboardStats(request.user.id);
    return sendSuccess(reply, 200, stats, 'Student dashboard stats fetched');
  } catch (error) {
    return sendError(reply, 500, 'Failed to fetch dashboard stats');
  }
}

export async function getTeacherDashboardHandler(request, reply) {
  try {
    const stats = await getTeacherDashboardStats(request.user);
    return sendSuccess(reply, 200, stats, 'Teacher dashboard stats fetched');
  } catch (error) {
    return sendError(reply, 500, 'Failed to fetch dashboard stats');
  }
}
