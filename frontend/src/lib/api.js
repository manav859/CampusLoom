import axios from 'axios';
import { getToken, removeToken } from './auth';

/**
 * Centralized Axios instance for CampusLoom API.
 *
 * Features:
 * - Base URL from environment variable (VITE_API_URL)
 * - 15-second timeout for all requests
 * - Request interceptor: attaches JWT bearer token
 * - Response interceptor: returns the backend envelope and normalizes errors
 * - Global 401 hooks so auth state can invalidate cleanly without UI coupling
 */
const API_PREFIX = '/api/v1';
const DEFAULT_API_HOST = 'http://localhost:5000';

const SAFE_ERROR_MESSAGES = {
  network: 'Unable to reach the server right now. Please check your connection and try again.',
  timeout: 'The request took too long to complete. Please try again.',
  unknown: 'Something went wrong. Please try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to access this resource.',
  notFound: 'This feature is not available yet.',
  server: 'The server is temporarily unavailable. Please try again later.',
};

export function normalizeApiBaseUrl(value) {
  const trimmedValue = (value || DEFAULT_API_HOST).trim().replace(/\/+$/, '');
  const withoutDuplicatedPrefix = trimmedValue.replace(/(?:\/api\/v1)+$/i, '');

  return `${withoutDuplicatedPrefix}${API_PREFIX}`;
}

function sanitizeErrorMessage(status, serverMessage) {
  if (status === 400 || status === 409) {
    return serverMessage || SAFE_ERROR_MESSAGES.unknown;
  }

  if (status === 401) {
    if (serverMessage === 'Invalid credentials' || serverMessage === 'User account is deactivated') {
      return serverMessage;
    }

    return SAFE_ERROR_MESSAGES.unauthorized;
  }

  if (status === 403) {
    return SAFE_ERROR_MESSAGES.forbidden;
  }

  if (status === 404) {
    return SAFE_ERROR_MESSAGES.notFound;
  }

  if (status >= 500) {
    return SAFE_ERROR_MESSAGES.server;
  }

  return serverMessage || SAFE_ERROR_MESSAGES.unknown;
}

function normalizeSuccessResponse(response) {
  const envelope = response?.data ?? {};

  return {
    ...response,
    data: envelope?.data ?? null,
    envelope,
    meta: {
      success: envelope?.success ?? true,
      message: envelope?.message ?? null,
    },
  };
}

function normalizeApiError(error) {
  const status = error.response?.status ?? null;
  const serverMessage = error.response?.data?.message;
  const timeout = error.code === 'ECONNABORTED';
  const network = !error.response;

  return {
    status,
    code: error.response?.data?.code || error.code || 'UNKNOWN_ERROR',
    message: timeout
      ? SAFE_ERROR_MESSAGES.timeout
      : network
        ? SAFE_ERROR_MESSAGES.network
        : sanitizeErrorMessage(status, serverMessage),
    errors: Array.isArray(error.response?.data?.errors) ? error.response.data.errors : [],
    isUnauthorized: status === 401,
    isNotFound: status === 404,
    isNetworkError: network,
    isTimeoutError: timeout,
    isRetryable: network || timeout || status === 429 || status >= 500,
    envelope: error.response?.data ?? null,
  };
}

function shouldUseFallback(error, options) {
  const {
    fallbackStatusCodes = [404],
    fallbackOnNetworkError = false,
    fallbackOnTimeoutError = false,
  } = options;

  if (error.isNotFound && fallbackStatusCodes.includes(404)) {
    return true;
  }

  if (error.status && fallbackStatusCodes.includes(error.status)) {
    return true;
  }

  if (fallbackOnNetworkError && error.isNetworkError) {
    return true;
  }

  if (fallbackOnTimeoutError && error.isTimeoutError) {
    return true;
  }

  return false;
}

export function createFallbackMeta(reason, source) {
  return {
    isFallback: true,
    reason,
    source,
  };
}

export async function requestWithFallback(requestFn, options = {}) {
  const {
    fallbackData = null,
    fallbackFactory,
  } = options;

  try {
    const response = await requestFn();

    return response?.data ?? response;
  } catch (error) {
    if (shouldUseFallback(error, options)) {
      if (typeof fallbackFactory === 'function') {
        return fallbackFactory(error);
      }

      return fallbackData;
    }

    throw error;
  }
}

export function getErrorMessage(error, fallbackMessage = SAFE_ERROR_MESSAGES.unknown) {
  return error?.message || fallbackMessage;
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_URL),
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const unauthorizedHandlers = new Set();

export const registerUnauthorizedHandler = (handler) => {
  unauthorizedHandlers.add(handler);

  return () => {
    unauthorizedHandlers.delete(handler);
  };
};

const notifyUnauthorizedHandlers = (error) => {
  unauthorizedHandlers.forEach((handler) => {
    try {
      handler(error);
    } catch (handlerError) {
      console.error('Unauthorized handler failed', handlerError);
    }
  });
};

api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  normalizeSuccessResponse,
  (error) => {
    const normalizedError = normalizeApiError(error);

    // Global 401 Handling -> trigger logout
    if (normalizedError.status === 401 && !error.config?.skipAuthRedirect) {
      removeToken();
      notifyUnauthorizedHandlers(normalizedError);
    }

    // Global 404 / Network Error Safe Fallback -> resolve instead of reject for GETs
    // so the UI receives empty data instead of crashing into unhandled promise rejections.
    if (!error.config?.strictErrorHandling && error.config?.method === 'get') {
      if (normalizedError.status === 404 || normalizedError.isNetworkError || normalizedError.isTimeoutError) {
        console.warn(`[Safe API Fallback] Handled ${normalizedError.status || 'Network/Timeout'} at ${error.config.url}`);
        return Promise.resolve({
          data: null,
          meta: {
            success: false,
            isFallback: true,
            reason: normalizedError.status === 404 ? '404_NOT_FOUND' : 'NETWORK_OR_TIMEOUT',
            message: normalizedError.message,
          },
        });
      }
    }

    return Promise.reject(normalizedError);
  },
);

export default api;
