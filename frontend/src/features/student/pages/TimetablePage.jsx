import { CalendarDays, Clock, Info } from 'lucide-react';
import { useStudentTimetable } from '../hooks/useStudentQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TimetablePage() {
  const { data: entries = [], isLoading, isError, error, refetch } = useStudentTimetable();

  if (isLoading) {
    return <Loading title="Loading Timetable" description="Organizing your academic schedule..." />;
  }

  if (isError) {
    return <ApiErrorState title="Error" message={error?.message} onRetry={refetch} />;
  }

  // Map entries into a lookup for the grid
  const timetableMap = {};
  entries.forEach(entry => {
    if (!timetableMap[entry.day]) timetableMap[entry.day] = {};
    timetableMap[entry.day][entry.period] = entry;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Schedule</p>
        <h1 className="text-4xl font-black tracking-tight">Class Timetable</h1>
      </div>

      {entries.length === 0 ? (
        <EmptyState
            title="Timetable not published"
            description="The academic schedule for your class has not been uploaded yet."
            icon={CalendarDays}
        />
      ) : (
        <div className="space-y-6">
            <div className="rounded-3xl border border-border/70 bg-card/30 overflow-hidden shadow-premium">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/20 sticky left-0 z-10 w-32 border-r">Day / Period</th>
                                {PERIODS.map(p => (
                                    <th key={p} className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground text-center border-r last:border-0">
                                        Period {p}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {DAYS.map(day => (
                                <tr key={day} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-5 font-bold text-sm bg-muted/10 sticky left-0 z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                        {day}
                                    </td>
                                    {PERIODS.map(p => {
                                        const entry = timetableMap[day]?.[p];
                                        return (
                                            <td key={`${day}-${p}`} className="p-3 border-r last:border-0 align-top">
                                                {entry ? (
                                                    <div className="p-3 rounded-2xl bg-primary/5 border border-primary/15 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-black uppercase text-primary/80 border-primary/20">{entry.subject}</Badge>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                                                <Clock className="size-2.5" />
                                                                {entry.startTime} - {entry.endTime}
                                                            </p>
                                                            <p className="text-[11px] font-semibold truncate text-foreground/80">Prof. {entry.teacher?.name?.split(' ')[0]}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-16 flex items-center justify-center border border-dashed rounded-2xl opacity-10">
                                                        <span className="text-[10px] uppercase font-black tracking-widest">Break</span>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary/80 max-w-2xl">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>
                    Timetable entries are managed by the academic administration. Room numbers and specific faculty adjustments will be reflected here in real-time.
                </p>
            </div>
        </div>
      )}
    </div>
  );
}
