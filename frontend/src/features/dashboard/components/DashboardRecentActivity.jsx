import { Clock3 } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function DashboardRecentActivity({ activities = [], moduleStatus = [] }) {
  const safeActivities = Array.isArray(activities) ? activities : [];
  const safeModuleStatus = Array.isArray(moduleStatus) ? moduleStatus : [];

  return (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="border-none">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest backend-backed admin events available right now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {safeActivities.length > 0 ? (
            safeActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 rounded-2xl border border-border/60 bg-background/70 p-4"
              >
                <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Clock3 className="size-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{activity.title}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {activity.type}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">{formatTimestamp(activity.timestamp)}</p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="No activity yet"
              description="Recent activity will populate automatically when live modules start generating records."
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-none">
        <CardHeader>
          <CardTitle>Module Status</CardTitle>
          <CardDescription>Live collections detected from the backend database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {safeModuleStatus.length > 0 ? (
            safeModuleStatus.map((module) => (
              <div
                key={module.key}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{module.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {module.implemented ? 'Collection available' : 'Awaiting backend module data'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{module.total}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    records
                  </p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="Module status unavailable"
              description="Collection readiness will appear here once the dashboard service can inspect backend modules."
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
