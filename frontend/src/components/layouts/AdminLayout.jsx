import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  FileText,
  GraduationCap,
  Bell,
  Settings,
  Menu,
  X,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

const SIDEBAR_LINKS = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Admissions', path: '/admin/admissions', icon: GraduationCap },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Pages', path: '/admin/pages', icon: FileText },
  { label: 'Notices', path: '/admin/notices', icon: Bell },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

const SidebarContent = ({ collapsed, mobile, onLogout, setMobileSidebarOpen }) => (
  <div className="flex h-full flex-col overflow-hidden bg-card">
    <div className="mb-6 flex h-16 items-center px-6">
      <Logo
        size="md"
        showIcon={true}
        hideText={collapsed && !mobile}
        className={cn('transition-all duration-300', collapsed && !mobile ? 'ml-0' : 'ml-1')}
      />
    </div>

    <nav className="flex-1 space-y-1.5 px-3">
      {SIDEBAR_LINKS.map((link) => (
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
              'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-300',
              isActive
                ? 'scale-[1.02] bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:translate-x-1 hover:bg-muted hover:text-foreground',
              collapsed && !mobile && 'justify-center px-0 scale-100 hover:translate-x-0',
            )
          }
        >
          <link.icon className="size-5 shrink-0" />
          <span
            className={cn(
              'absolute left-12 overflow-hidden whitespace-nowrap transition-all duration-300',
              collapsed && !mobile
                ? 'invisible w-0 opacity-0'
                : 'visible relative left-0 w-auto opacity-100',
            )}
          >
            {link.label}
          </span>
        </NavLink>
      ))}
    </nav>

    <div className="mt-auto border-t p-3">
      <button
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-destructive/10 hover:text-destructive',
          collapsed && !mobile && 'justify-center px-0',
        )}
        onClick={onLogout}
      >
        <LogOut className="size-5 shrink-0 transition-transform group-hover:rotate-180" />
        <span
          className={cn(
            'absolute left-12 overflow-hidden whitespace-nowrap transition-all duration-300',
            collapsed && !mobile
              ? 'invisible w-0 opacity-0'
              : 'visible relative left-0 w-auto opacity-100',
          )}
        >
          Logout
        </span>
      </button>
    </div>
  </div>
);

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuthSession();

  const pathSegments = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));

  const handleLogout = () => {
    logout();
    setMobileSidebarOpen(false);
    navigate('/login', { replace: true });
  };

  const displayName = user?.email || 'Administrator';
  const displayRole = user?.role || 'ADMIN';
  const avatarLabel = displayName.charAt(0).toUpperCase();
  const MotionDiv = motion.div;
  const MotionAside = motion.aside;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          'hidden shrink-0 border-r bg-card transition-all duration-300 ease-in-out lg:block',
          sidebarOpen ? 'w-64' : 'w-20',
        )}
      >
        <SidebarContent
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
              {pathSegments.map((segment, index) => (
                <span key={segment} className="flex items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="size-3" /> : null}
                  <span className={cn(index === pathSegments.length - 1 ? 'text-foreground opacity-100' : '')}>
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

        <main className="reveal flex-1 overflow-y-auto bg-muted/20 p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
