/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken, removeToken, setToken } from '@/lib/auth';
import { registerUnauthorizedHandler } from '@/lib/api';
import { authQueryKeys, getCurrentUser, loginUser, registerUser } from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const clearSession = useCallback(
    ({ clearQueryCache = false } = {}) => {
      removeToken();
      setUser(null);
      setAuthError(null);

      if (clearQueryCache) {
        queryClient.clear();
        return;
      }

      queryClient.removeQueries({ queryKey: authQueryKeys.me() });
    },
    [queryClient],
  );

  const syncCurrentUser = useCallback(async () => {
    const currentUser = await queryClient.fetchQuery({
      queryKey: authQueryKeys.me(),
      queryFn: getCurrentUser,
      staleTime: 0,
    });

    setUser(currentUser);
    setAuthError(null);

    return currentUser;
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const token = getToken();

      if (!token) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      try {
        await syncCurrentUser();
      } catch (error) {
        if (isMounted) {
          if (error.isUnauthorized) {
            clearSession({ clearQueryCache: true });
          } else {
            setUser(null);
            queryClient.removeQueries({ queryKey: authQueryKeys.me() });
          }

          setAuthError(error.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [clearSession, queryClient, syncCurrentUser]);

  useEffect(() => {
    const unregister = registerUnauthorizedHandler(() => {
      clearSession({ clearQueryCache: true });
      setIsLoading(false);
    });

    return unregister;
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const { token, user: authenticatedUser } = await loginUser({ email, password });
      setToken(token);
      setUser(authenticatedUser ?? null);
      queryClient.setQueryData(authQueryKeys.me(), authenticatedUser ?? null);

      if (authenticatedUser) {
        return authenticatedUser;
      }

      return await syncCurrentUser();
    } catch (error) {
      clearSession();
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [clearSession, queryClient, syncCurrentUser]);

  const register = useCallback(async (payload) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      return await registerUser(payload);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession({ clearQueryCache: true });
    setIsLoading(false);
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      hasStoredSession: Boolean(getToken()),
      isLoading,
      authError,
      login,
      register,
      logout,
    }),
    [authError, isLoading, login, logout, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
