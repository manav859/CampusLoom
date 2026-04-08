import { FileText, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const STAT_ICON_MAP = {
  totalUsers: Users,
  activeUsers: ShieldCheck,
  totalAdmissions: GraduationCap,
  totalNotices: FileText,
};

export default function DashboardStatsGrid({ stats = [] }) {
  const visibleStats = Array.isArray(stats) ? stats : [];

  if (visibleStats.length === 0) {
    return (
      <EmptyState
        title="No dashboard metrics yet"
        description="Summary cards will appear here once the dashboard service returns module statistics."
      />
    );
  }

  return (
    <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {visibleStats.map((stat) => {
        const Icon = STAT_ICON_MAP[stat.key] || Users;

        return (
          <Card key={stat.key} className="border-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
              <div className="space-y-1">
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.2em]">
                  {stat.label}
                </CardDescription>
                <CardTitle className="text-3xl font-black tracking-tight">
                  {stat.value}
                </CardTitle>
              </div>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-sm text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
