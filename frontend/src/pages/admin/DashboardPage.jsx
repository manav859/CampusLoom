import { RefreshCcw, ServerCrash } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import DashboardCharts from '@/features/dashboard/components/DashboardCharts';
import DashboardRecentActivity from '@/features/dashboard/components/DashboardRecentActivity';
import DashboardSkeleton from '@/features/dashboard/components/DashboardSkeleton';
import DashboardStatsGrid from '@/features/dashboard/components/DashboardStatsGrid';
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats';

export default function DashboardPage() {
  const { user } = useAuthSession();
  const { data, error, isError, isFetching, isLoading, refetch } = useDashboardStats();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message={getErrorMessage(error)}
        actionLabel="Retry dashboard"
        onAction={() => refetch()}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={ServerCrash}
        title="Dashboard unavailable"
        description="No dashboard data is available right now. Try refreshing once the admin API is ready."
        actionLabel="Reload dashboard"
        onAction={() => refetch()}
      />
    );
  }

  const generatedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleString('en-IN') : 'Awaiting data';
  const stats = Array.isArray(data?.stats) ? data.stats : [];
  const registrations = Array.isArray(data?.charts?.userRegistrations) ? data.charts.userRegistrations : [];
  const distribution = Array.isArray(data?.charts?.entityDistribution) ? data.charts.entityDistribution : [];
  const activities = Array.isArray(data?.recentActivity) ? data.recentActivity : [];
  const moduleStatus = Array.isArray(data?.moduleStatus) ? data.moduleStatus : [];
  const isFallback = data?.meta?.isFallback;

  return (
    <div className="space-y-10 reveal">
      {isFallback ? (
        <EmptyState
          icon={ServerCrash}
          title="Feature not available yet"
          description="The dashboard API is currently unavailable, so you are seeing a safe placeholder state instead of a crash."
          actionLabel="Retry dashboard"
          onAction={() => refetch()}
        />
      ) : null}

      <section className="relative overflow-hidden rounded-3xl bg-primary px-8 py-10 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-white to-transparent opacity-10" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
              Live admin overview
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Welcome back, {user?.email?.split('@')[0] || 'Admin'}
              </h1>
              <p className="max-w-2xl text-primary-foreground/75">
                The dashboard runs on authenticated backend data. Counts, charts, and activity are
                fetched through React Query and stay protected behind your active session.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-primary-foreground/80">
            <p>Last generated: {generatedAt}</p>
            <Button
              type="button"
              variant="secondary"
              className="bg-white/15 text-primary-foreground hover:bg-white/20"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Refresh data <RefreshCcw className={`ml-2 size-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </section>

      <DashboardStatsGrid stats={stats} />
      <DashboardCharts
        registrations={registrations}
        distribution={distribution}
      />
      <DashboardRecentActivity
        activities={activities}
        moduleStatus={moduleStatus}
      />
    </div>
  );
}
