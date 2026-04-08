import { sendError, sendSuccess } from '../../utils/response.js';
import { getDashboardStats } from './dashboard.service.js';

export async function getDashboardStatsHandler(request, reply) {
  try {
    const stats = await getDashboardStats();

    return sendSuccess(reply, 200, stats, 'Dashboard statistics fetched successfully');
  } catch (error) {
    request.log.error(error);

    return sendError(reply, 500, 'Failed to fetch dashboard statistics');
  }
}
