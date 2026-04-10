import { Calendar, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useStudentAttendance } from '../hooks/useStudentQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AttendancePage() {
  const { data, isLoading, isError, error, refetch } = useStudentAttendance();

  if (isLoading) {
    return <Loading title="Fetching Attendance" description="Reviewing your attendance history..." />;
  }

  if (isError) {
    return (
      <ApiErrorState
        title="Unable to load attendance"
        message={error?.message || 'We could not fetch your attendance data.'}
        onRetry={refetch}
      />
    );
  }

  const { records = [], summary = {} } = data || {};

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Attendance</p>
        <h1 className="text-4xl font-black tracking-tight">Academic Presence</h1>
      </div>

      {/* Summary Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Attendance Percentage" 
          value={`${summary.percentage || 0}%`} 
          description="Total average attendance"
          color="primary"
        />
        <StatCard 
          label="Days Present" 
          value={summary.present || 0} 
          description="Total present markings"
          color="emerald"
        />
        <StatCard 
          label="Days Absent" 
          value={summary.absent || 0} 
          description="Total absent markings"
          color="destructive"
        />
        <StatCard 
          label="Total Working Days" 
          value={summary.total || 0} 
          description="Marked sessions to date"
          color="muted"
        />
      </section>

      {/* Records List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recent History</h2>
        </div>

        {records.length === 0 ? (
          <EmptyState
            title="No records found"
            description="Your attendance hasn't been marked yet. Contact your teacher if you believe this is an error."
            icon={Calendar}
          />
        ) : (
          <div className="rounded-3xl border border-border/70 bg-card/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                    <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-5 font-semibold text-foreground/90">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="p-5">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="p-5 text-sm text-muted-foreground">
                        {record.status === 'present' ? 'Attended scheduled session' : 'Absent from scheduled session'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary/80">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Note: Attendance is marked daily by your subject teachers. If you have any discrepancy, please raise an inquiry with the department office.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, description, color }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    emerald: 'text-emerald-700 bg-emerald-100/50 border-emerald-200',
    destructive: 'text-destructive bg-destructive/10 border-destructive/20',
    muted: 'text-muted-foreground bg-muted/50 border-border',
  };

  return (
    <Card className={cn("border shadow-none", colorMap[color])}>
      <CardHeader className="pb-2">
        <CardDescription className="font-bold uppercase tracking-widest text-[10px] opacity-70">{label}</CardDescription>
        <CardTitle className="text-3xl font-black">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs opacity-60">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  if (status === 'present') {
    return (
      <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 px-3 py-1">
        <CheckCircle2 className="size-3.5" />
        Present
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 border-destructive/30 bg-destructive/10 text-destructive px-3 py-1">
      <XCircle className="size-3.5" />
      Absent
    </Badge>
  );
}
