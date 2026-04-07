import { Navigate, useLocation } from 'react-router-dom';

/**
 * Route guard component for protected admin routes.
 *
 * Phase 1: Pass-through (no auth check) — all routes are accessible.
 * Phase 2: Will check JWT token validity and user roles (RBAC).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Protected content
 * @param {string[]} [props.allowedRoles] - Future: list of roles permitted (RBAC)
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  // TODO: Phase 2 — Implement actual auth checks
  // const { isAuthenticated, user } = useAuth();
  // const location = useLocation();

  // if (!isAuthenticated) {
  //   return <Navigate to="/login" state={{ from: location }} replace />;
  // }

  // if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
  //   return <Navigate to="/unauthorized" replace />;
  // }

  return children;
}
