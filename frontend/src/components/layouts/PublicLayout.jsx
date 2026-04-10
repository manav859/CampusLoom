import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Notices', path: '/notices' },
  { label: 'Admissions', path: '/admissions' },
  { label: 'Contact', path: '/contact' },
];

/**
 * Public-facing Layout - Modern & Spacious.
 * Sticky navigation with Glassmorphism and responsive Drawer.
 */
export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { hasStoredSession, isAuthenticated, isLoading, logout, user } = useAuthSession();

  const isResolvingSession = hasStoredSession && isLoading;
  const primaryAction = useMemo(() => {
    if (!isAuthenticated || !user) {
      return { label: 'Sign In', path: '/register' };
    }

    return { label: 'My Account', path: '/account' };
  }, [isAuthenticated, user]);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20 selection:text-primary">
      {/* ─── Sticky Glass Navbar ─── */}
      <header className="glass sticky top-0 z-50 w-full border-b">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-12">
          <Link to="/" className="shrink-0 transition-transform hover:scale-[1.02] active:scale-95">
            <Logo size="md" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1.5 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="ml-4 flex items-center gap-3 border-l pl-4">
              {!isResolvingSession ? (
                <>
                  {user?.role === 'admin' && (
                    <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                      <Link to="/admin">Admin</Link>
                    </Button>
                  )}
                  <Button variant="default" size="default" asChild>
                    <Link to={primaryAction.path}>{primaryAction.label}</Link>
                  </Button>
                  {isAuthenticated ? (
                    <Button variant="ghost" size="default" onClick={handleLogout}>
                      Logout
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </nav>

          {/* Mobile Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Toggle navigation menu"
          >
            <Menu className="size-6" />
          </Button>
        </div>
      </header>

      {/* ─── Mobile Sidebar Overlay Drawer ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex md:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-[100] h-full w-full max-w-sm border-r bg-background shadow-2xl animate-slide-in">
            <div className="flex h-20 items-center justify-between border-b px-6">
              <Logo size="md" />
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="size-6" />
              </Button>
            </div>
            <nav className="flex flex-col gap-2 p-6">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-4 py-4 text-base font-medium transition-all duration-300',
                      isActive
                        ? 'bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {!isResolvingSession ? (
                <div className="mt-4 space-y-3 border-t pt-6">
                  {user?.role === 'admin' && (
                    <Button variant="outline" size="lg" className="w-full" asChild>
                      <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                        Admin Panel
                      </Link>
                    </Button>
                  )}
                  <Button variant="default" size="lg" className="w-full" asChild>
                    <Link to={primaryAction.path} onClick={() => setMobileMenuOpen(false)}>
                      {primaryAction.label}
                    </Link>
                  </Button>
                  {isAuthenticated ? (
                    <Button variant="outline" size="lg" className="w-full" onClick={handleLogout}>
                      Logout
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </nav>
          </aside>
        </div>
      )}

      {/* ─── Page Content Canvas ─── */}
      <main className="flex-1 reveal">
        <Outlet />
      </main>

      {/* ─── Modern Minimal Footer ─── */}
      <footer className="border-t bg-muted/20 pb-16 pt-12">
        <div className="mx-auto max-w-7xl px-8">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <div className="space-y-2 text-center sm:text-left">
                <Logo size="sm" />
                <p className="text-xs text-muted-foreground opacity-60">
                    Empowering education via modern infrastructure.
                </p>
            </div>
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase opacity-40">
              &copy; {new Date().getFullYear()} CampusLoom. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
