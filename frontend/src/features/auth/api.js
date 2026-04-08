import api, { requestWithFallback } from '@/lib/api';

export const authQueryKeys = {
  all: ['auth'],
  me: () => [...authQueryKeys.all, 'me'],
};

export async function loginUser(credentials) {
  const response = await api.post('/auth/login', credentials, {
    skipAuthRedirect: true,
  });

  return response.data;
}

export async function registerUser(payload) {
  const response = await api.post('/auth/register', payload, {
    skipAuthRedirect: true,
  });

  return response.data;
}

export async function getCurrentUser() {
  const data = await requestWithFallback(() => api.get('/auth/me'), {
    fallbackData: { user: null },
    fallbackStatusCodes: [404],
  });

  return data?.user ?? null;
}
