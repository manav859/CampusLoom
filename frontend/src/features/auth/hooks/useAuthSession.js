import { useAuth } from '../AuthContext';

export function useAuthSession() {
  return useAuth();
}
