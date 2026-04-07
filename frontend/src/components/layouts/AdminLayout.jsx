import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
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

const SIDEBAR_LINKS = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Admissions', path: '/admin/admissions', icon: GraduationCap },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Pages', path: '/admin/pages', icon: FileText },
  { label: 'Notices', path: '/admin/notices', icon: Bell },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

/**
 * Admin Panel - Layout Wrapper.
 * Features a collapsible sidebar (Desktop) and an Overlay Drawer (Mobile).
 */
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  const pathSegments = location.pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1));

  const SidebarContent = () => (
    <div className="flex h-full flex-col p-4">
      {/* Brand */}
      <div className="mb-6 flex h-14 items-center px-2">
        <Logo size={sidebarOpen ? 'md' : 'sm'} showIcon={true} />
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1.5">
        {SIDEBAR_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.end}
            onClick={() => setMobileSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-300',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1'
              )
            }
          >
            <link.icon className="size-5 shrink-0" />
            {sidebarOpen && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="mt-auto border-t pt-4">
        <button
          className="group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {}}
        >
          <LogOut className="size-5 shrink-0 transition-transform group-hover:rotate-180" />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={cn(
          'hidden border-r bg-card transition-all duration-500 ease-in-out lg:block',
          sidebarOpen ? 'w-72' : 'w-24'
        )}
      >
        <SidebarContent />
      </aside>

      {/* ─── Mobile Sidebar Overlay Drawer ─── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative z-50 h-full w-72 bg-card shadow-2xl animate-slide-in">
            <SidebarContent />
            <button
                className="absolute top-4 right-4 p-2 text-muted-foreground"
                onClick={() => setMobileSidebarOpen(false)}
            >
                <X className="size-6" />
            </button>
          </aside>
        </div>
      )}

      {/* ─── Main Content Canvas ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="glass flex h-16 shrink-0 items-center justify-between border-b px-4 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Toggles */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="size-6" />
            </Button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase opacity-70">
              {pathSegments.map((segment, index) => (
                <span key={segment} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronRight className="size-3" />}
                  <span className={cn(index === pathSegments.length - 1 ? 'text-foreground opacity-100' : '')}>
                    {segment}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          {/* Profile Hub */}
          <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none">Admin User</p>
                <p className="text-[10px] text-muted-foreground leading-tight">SuperAdmin</p>
             </div>
             <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
                A
             </div>
          </div>
        </header>

        {/* Scrollable Content Region */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6 lg:p-10 reveal">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
