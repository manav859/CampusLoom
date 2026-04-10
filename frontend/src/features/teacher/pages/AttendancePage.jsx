import { useState } from 'react';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, Save, Filter, Search, Loader2 } from 'lucide-react';
import { useClassAttendance, useMarkAttendance } from '../hooks/useTeacherQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Sample classes - in real app, these come from the teacher's profile/timetable
const ASSIGNED_CLASSES = ['10-A', '10-B', '11-A', '11-B', '12-A'];

export default function AttendancePage() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [localRecords, setLocalRecords] = useState([]);

  const { data: records, isLoading, isError, error, refetch } = useClassAttendance({
    class: selectedClass,
    date: selectedDate,
  });

  const markMutation = useMarkAttendance();

  // Update local state when remote data changes
  useState(() => {
    if (records) {
      setLocalRecords(records.map(r => ({ ...r, status: r.status || 'present' })));
    }
  }, [records]);

  // Handle local status change
  const toggleStatus = (studentId) => {
    setLocalRecords(prev => prev.map(r => 
      r.studentId === studentId 
        ? { ...r, status: r.status === 'present' ? 'absent' : 'present' } 
        : r
    ));
  };

  const handleSave = async () => {
    try {
      await markMutation.mutateAsync({
        class: selectedClass,
        date: selectedDate,
        records: localRecords.map(({ studentId, status }) => ({ studentId, status })),
      });
      toast.success('Attendance saved successfully');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to save attendance');
    }
  };

  const filteredRecords = localRecords.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Management</p>
          <h1 className="text-4xl font-black tracking-tight">Attendance</h1>
        </div>
        
        {selectedClass && (
          <Button 
            onClick={handleSave} 
            disabled={markMutation.isPending || localRecords.length === 0}
            className="w-full sm:w-auto gap-2"
          >
            {markMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Changes
          </Button>
        )}
      </div>

      <Card className="border-border/60 bg-card/30 shadow-none">
        <CardContent className="pt-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Select Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNED_CLASSES.map(cls => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl h-12 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2 lg:col-span-1">
              <label className="text-sm font-semibold text-muted-foreground">Search Student</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Filter by name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl h-12 pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClass ? (
        <Card className="border-dashed h-64 flex items-center justify-center text-center">
            <div className="space-y-3 p-6">
                <Filter className="size-12 mx-auto text-muted-foreground/20" />
                <CardDescription className="text-base">Please select a class and date to start marking attendance.</CardDescription>
            </div>
        </Card>
      ) : isLoading ? (
        <Loading title="Fetching Students" description="Loading your class roster..." />
      ) : isError ? (
        <ApiErrorState title="Roster Error" message={error?.message} onRetry={refetch} />
      ) : (
        <section className="space-y-4">
           <div className="rounded-3xl border border-border/70 bg-card/30 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground w-1/2">Student Name</th>
                                <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Status</th>
                                <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right font-medium">Toggle Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredRecords.map((record) => (
                                <tr key={record.studentId} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-5 font-semibold text-foreground/90">
                                        {record.name}
                                    </td>
                                    <td className="p-5 text-center">
                                         <StatusBadge status={record.status} />
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button 
                                                size="sm" 
                                                variant={record.status === 'present' ? 'default' : 'outline'}
                                                className="rounded-full w-24"
                                                onClick={() => toggleStatus(record.studentId)}
                                            >
                                                Present
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant={record.status === 'absent' ? 'destructive' : 'outline'}
                                                className="rounded-full w-24"
                                                onClick={() => toggleStatus(record.studentId)}
                                            >
                                                Absent
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
           </div>
        </section>
      )}
    </div>
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
