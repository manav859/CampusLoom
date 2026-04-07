import axios from 'axios';

/**
 * Centralized Axios instance for CampusLoom API.
 *
 * Features:
 * - Base URL from environment variable (VITE_API_URL)
 * - 15-second timeout for all requests
 * - Request interceptor: attaches JWT bearer token (ready for auth)
 * - Response interceptor: unwraps success envelope, handles 401 redirects
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ──────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // TODO: Phase 2 — Attach JWT token from auth store
    // const token = localStorage.getItem('accessToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Unwrap the standard success envelope: { success, message, data }
    return response.data;
  },
  (error) => {
    const status = error.response?.status;

    // TODO: Phase 2 — Handle 401 Unauthorized (token expired / invalid)
    // if (status === 401) {
    //   localStorage.removeItem('accessToken');
    //   window.location.href = '/login';
    // }

    // Extract backend error message from envelope
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject({
      status,
      message,
      errors: error.response?.data?.errors || [],
      raw: error,
    });
  }
);

export default api;
