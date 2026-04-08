import api, { createFallbackMeta, requestWithFallback } from '@/lib/api';

export const dashboardQueryKeys = {
  all: ['dashboard'],
  stats: () => [...dashboardQueryKeys.all, 'stats'],
};

export function createDashboardFallbackData(reason = 'not_available') {
  return {
    generatedAt: null,
    stats: [],
    charts: {
      userRegistrations: [],
      entityDistribution: [],
    },
    recentActivity: [],
    moduleStatus: [],
    meta: createFallbackMeta(reason, 'dashboard'),
  };
}

export async function getDashboardStats() {
  return requestWithFallback(() => api.get('/dashboard/stats'), {
    fallbackFactory: (error) =>
      createDashboardFallbackData(
        error.isNetworkError || error.isTimeoutError ? 'service_unavailable' : 'not_found',
      ),
    fallbackStatusCodes: [404],
    fallbackOnNetworkError: true,
    fallbackOnTimeoutError: true,
  });
}
