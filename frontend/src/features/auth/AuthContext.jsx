import { createContext, useContext, useState, useEffect } from 'react';
import { getToken, setToken, removeToken } from '@/lib/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          // TODO: Replace with real /auth/me call to validate token and get user info
          // For Day 2, we mock validation by just assuming a valid token exists
          setUser({ email: 'admin@campusloom.com', role: 'admin' });
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Auth validation failed", error);
          removeToken();
          setIsAuthenticated(false);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      // TODO: Replace with real /auth/login call
      // Mocking API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (email === 'admin@campusloom.com' && password === 'password123') {
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockToken';
        setToken(mockToken);
        setUser({ email, role: 'admin' });
        setIsAuthenticated(true);
        return { success: true };
      } else {
        throw new Error("Invalid credentials");
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
