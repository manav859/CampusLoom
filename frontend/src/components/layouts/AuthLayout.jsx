import { Outlet } from 'react-router-dom';
import Logo from '@/components/common/Logo';

/**
 * Minimal auth layout for login/register pages.
 * Centered card design with no navbar/sidebar.
 */
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} CampusLoom. Secure admin access.
      </p>
    </div>
  );
}
