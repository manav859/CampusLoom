import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PIE_COLORS = ['#1d4ed8', '#2563eb', '#f59e0b', '#ef4444'];

export default function DashboardCharts({ registrations = [], distribution = [] }) {
  const registrationSeries = Array.isArray(registrations) ? registrations : [];
  const distributionSeries = Array.isArray(distribution) ? distribution : [];
  const hasRegistrations = registrationSeries.some((item) => item?.count > 0);
  const visibleDistribution = distributionSeries.filter((item) => item?.value > 0);

  return (
    <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <Card className="border-none">
        <CardHeader>
          <CardTitle>Registration Trend</CardTitle>
          <CardDescription>Daily user signups across the last seven days.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {hasRegistrations ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={registrationSeries}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(30, 64, 175, 0.08)' }} />
                <Bar dataKey="count" radius={[14, 14, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No recent registrations"
              description="User creation activity will appear here once accounts start getting created."
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-none">
        <CardHeader>
          <CardTitle>Entity Mix</CardTitle>
          <CardDescription>Current live document counts grouped by domain.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {visibleDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibleDistribution}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={4}
                >
                  {visibleDistribution.map((entry, index) => (
                    <Cell key={entry.key} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No domain data yet"
              description="Additional collections will appear automatically as those backend modules go live."
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
