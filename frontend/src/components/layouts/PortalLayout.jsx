import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

/**
 * Shared layout component for both Student and Teacher dashboards.
 * 
 * @param {Array} sidebarLinks - List of navigation links for the sidebar
 * @param {string} portalName - The name of the portal (e.g. "Student Portal")
 * @param {string} baseTitle - The base breadcrumb name (e.g. "Account")
 */
const SidebarContent = ({ links, collapsed, mobile, onLogout, setMobileSidebarOpen }) => (
  <div className="flex h-full flex-col overflow-hidden bg-card">
    <div className="mb-6 flex h-16 items-center px-6 shrink-0">
      <Logo
        size="md"
        showIcon={true}
        hideText={collapsed && !mobile}
        className={cn('transition-[margin,opacity] duration-300', collapsed && !mobile ? 'ml-0' : 'ml-1')}
      />
    </div>

    <nav className="flex-1 space-y-1.5 px-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
      {links.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          end={link.end}
          onClick={() => {
            if (mobile) {
              setMobileSidebarOpen(false);
            }
          }}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-[transform,background-color,color] duration-300',
              isActive
                ? 'scale-[1.02] bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:translate-x-1 hover:bg-muted hover:text-foreground',
              collapsed && !mobile && 'justify-center px-0 scale-100 hover:translate-x-0',
            )
          }
          title={collapsed && !mobile ? link.label : undefined}
        >
          <link.icon className="size-5 shrink-0" />
          <span
            className={cn(
              'absolute left-12 overflow-hidden whitespace-nowrap transition-[opacity,width,transform] duration-300',
              collapsed && !mobile
                ? 'invisible w-0 opacity-0 -translate-x-2'
                : 'visible relative left-0 w-auto opacity-100 translate-x-0',
            )}
          >
            {link.label}
          </span>
        </NavLink>
      ))}
    </nav>

    <div className="mt-auto border-t p-3 shrink-0">
      <button
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-muted-foreground transition-[background-color,color] duration-300 hover:bg-destructive/10 hover:text-destructive',
          collapsed && !mobile && 'justify-center px-0',
        )}
        onClick={onLogout}
        title={collapsed && !mobile ? 'Logout' : undefined}
      >
        <LogOut className="size-5 shrink-0 transition-transform group-hover:rotate-180" />
        <span
          className={cn(
            'absolute left-12 overflow-hidden whitespace-nowrap transition-[opacity,width,transform] duration-300',
            collapsed && !mobile
              ? 'invisible w-0 opacity-0 -translate-x-2'
              : 'visible relative left-0 w-auto opacity-100 translate-x-0',
          )}
        >
          Logout
        </span>
      </button>
    </div>
  </div>
);

export default function PortalLayout({ sidebarLinks, portalPathLabel = 'Portal' }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuthSession();

  // Create breadcrumbs based on pathname
  const pathSegments = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));

  // Determine segments displayed after the "Portal" root.
  // Logic: /account -> [Portal], /account/profile -> [Portal, Profile]
  // This helps skip the "Account" or "Teacher" index if it's the root.
  const displaySegments = pathSegments.length === 1 
    ? [] 
    : pathSegments.slice(1);

  const handleLogout = () => {
    logout();
    setMobileSidebarOpen(false);
    navigate('/', { replace: true });
  };

  const displayName = user?.name || user?.email || 'User';
  const displayRole = user?.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : 'Portal';
  const avatarLabel = displayName.charAt(0).toUpperCase();
  const MotionDiv = motion.div;
  const MotionAside = motion.aside;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          'hidden shrink-0 border-r bg-card transition-[width] duration-300 ease-in-out lg:block will-change-[width]',
          sidebarOpen ? 'w-[280px]' : 'w-20',
        )}
      >
        <SidebarContent
          links={sidebarLinks}
          collapsed={!sidebarOpen}
          mobile={false}
          onLogout={handleLogout}
          setMobileSidebarOpen={setMobileSidebarOpen}
        />
      </aside>

      <AnimatePresence>
        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />

            <MotionAside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-50 h-full w-72 border-r bg-card shadow-2xl"
            >
              <SidebarContent
                links={sidebarLinks}
                collapsed={false}
                mobile={true}
                onLogout={handleLogout}
                setMobileSidebarOpen={setMobileSidebarOpen}
              />
              <button
                className="absolute top-4 right-4 p-2 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <X className="size-6" />
              </button>
            </MotionAside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass flex h-16 shrink-0 items-center justify-between border-b px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-muted"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden transition-transform hover:bg-muted lg:flex"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className={cn('size-6 transition-transform', !sidebarOpen && 'rotate-180')} />
            </Button>

            <nav className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground opacity-70">
              <span className="flex items-center gap-1.5">
                 <span className={cn(displaySegments.length === 0 ? 'text-foreground opacity-100' : '')}>
                    {portalPathLabel}
                 </span>
              </span>
              {displaySegments.map((segment, index) => (
                <span key={segment} className="flex items-center gap-1.5">
                  <ChevronRight className="size-3" />
                  <span className={cn(index === displaySegments.length - 1 ? 'text-foreground opacity-100' : '')}>
                    {segment}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold leading-none">{displayName}</p>
              <p className="text-[10px] leading-tight text-muted-foreground">{displayRole}</p>
            </div>
            <div className="flex size-10 cursor-pointer items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105">
              {avatarLabel}
            </div>
          </div>
        </header>

        <main className="reveal flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
