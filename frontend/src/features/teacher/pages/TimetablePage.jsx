import { CalendarDays, Clock, Info, ExternalLink } from 'lucide-react';
import { useTeacherTimetable } from '../hooks/useTeacherQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetablePage() {
  const { data: entries = [], isLoading, isError, error, refetch } = useTeacherTimetable();

  if (isLoading) {
    return <Loading title="Fetching Schedule" description="Loading your personal teaching timetable..." />;
  }

  if (isError) {
    return <ApiErrorState title="Error" message={error?.message} onRetry={refetch} />;
  }

  // Group by day
  const groupedEntries = DAYS.reduce((acc, day) => {
    acc[day] = entries.filter(e => e.day === day).sort((a, b) => a.period - b.period);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Faculty</p>
        <h1 className="text-4xl font-black tracking-tight">Teaching Schedule</h1>
      </div>

      {entries.length === 0 ? (
        <EmptyState
            title="Schedule not assigned"
            description="You don't have any classes assigned to your timetable yet. Please contact the academic coordinator."
            icon={CalendarDays}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
            {DAYS.map(day => {
                const dayEntries = groupedEntries[day];
                if (dayEntries.length === 0) return null;

                return (
                    <div key={day} className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-primary hover:bg-primary px-3 py-1 rounded-lg text-sm">{day}</Badge>
                            <span className="text-xs text-muted-foreground font-medium">{dayEntries.length} Sessions</span>
                        </div>

                        <div className="space-y-4">
                            {dayEntries.map(entry => (
                                <Card key={entry.id} className="border-border/60 bg-card/30 shadow-none hover:bg-card/50 transition-colors">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 px-6">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                                                {entry.period}
                                            </div>
                                            <div className="space-y-0.5">
                                                <CardTitle className="text-lg leading-none">{entry.subject}</CardTitle>
                                                <CardDescription className="flex items-center gap-2">
                                                    <span className="font-bold text-primary/80">Class {entry.class}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="size-3" />
                                                        {entry.startTime} - {entry.endTime}
                                                    </span>
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost" className="gap-2" asChild>
                                            <Link to="/teacher/attendance">
                                                Mark Attendance
                                                <ExternalLink className="size-3" />
                                            </Link>
                                        </Button>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary/80 max-w-2xl">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Note: This timetable reflects your officially assigned sessions. For any substitution or change requests, please use the faculty portal alerts.
        </p>
      </div>
    </div>
  );
}
