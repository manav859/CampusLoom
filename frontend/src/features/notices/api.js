import api, { createFallbackMeta, requestWithFallback } from '@/lib/api';

export const noticesQueryKeys = {
  all: ['notices'],
  adminList: () => [...noticesQueryKeys.all, 'admin', 'list'],
  adminDetail: (noticeId) => [...noticesQueryKeys.all, 'admin', 'detail', noticeId],
  publicList: () => [...noticesQueryKeys.all, 'public', 'list'],
};

export function createPublicNoticesFallback(reason = 'not_available') {
  return {
    items: [],
    meta: createFallbackMeta(reason, 'public-notices'),
  };
}

export async function getAdminNotices() {
  const response = await api.get('/notices', {
    strictErrorHandling: true,
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function getAdminNoticeById(noticeId) {
  const response = await api.get(`/notices/${noticeId}`, {
    strictErrorHandling: true,
  });

  return response.data ?? null;
}

export async function createNotice(payload) {
  const response = await api.post('/notices', payload);

  return response.data;
}

export async function updateNotice({ noticeId, payload }) {
  const response = await api.put(`/notices/${noticeId}`, payload);

  return response.data;
}

export async function deleteNotice(noticeId) {
  const response = await api.delete(`/notices/${noticeId}`);

  return response.data;
}

export async function updateNoticeStatus({ noticeId, isActive }) {
  const response = await api.patch(`/notices/${noticeId}/status`, { isActive });

  return response.data;
}

export async function getPublicNotices() {
  return requestWithFallback(() => api.get('/public/notices'), {
    fallbackFactory: (error) =>
      createPublicNoticesFallback(
        error.isNetworkError || error.isTimeoutError ? 'service_unavailable' : 'not_found',
      ),
    fallbackStatusCodes: [404],
    fallbackOnNetworkError: true,
    fallbackOnTimeoutError: true,
  });
}
