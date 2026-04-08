import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import ErrorState from '@/components/common/ErrorState';
import AuthBootScreen from '@/features/auth/components/AuthBootScreen';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, authError, hasStoredSession } = useAuthSession();
  const location = useLocation();

  if (isLoading) {
    return <AuthBootScreen />;
  }

  if (hasStoredSession && authError && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <ErrorState
            title="Admin access is temporarily unavailable"
            message={authError}
            actionLabel="Return to login"
            onAction={() => navigate('/login', { replace: true, state: { from: location } })}
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
