import { Users, BookOpen, Clock, ArrowRight, UserRound, GraduationCap, Mail, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { useTeacherDashboard } from '../hooks/useTeacherQueries';
import { cn } from '@/lib/utils';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';

function InfoCard({ icon, label, value, color }) {
  const Icon = icon;
  return (
    <Card className={cn("border-border/70 shadow-none", color)}>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold">
          <Icon className="size-5" />
        </div>
        <div className="space-y-1">
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest">{label}</CardDescription>
          <CardTitle className="text-2xl font-black">{value}</CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function TeacherDashboardPage() {
  const { user } = useAuthSession();
  const { 
    data: stats, 
    isLoading: statsLoading,
  } = useTeacherDashboard();

  if (statsLoading) {
    return <Loading title="Loading teacher portal" description="Gathering your assignment data..." />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="border-indigo-500/10 bg-[linear-gradient(135deg,rgba(79,70,229,0.08),rgba(14,165,233,0.04),transparent)] shadow-premium">
          <CardHeader className="space-y-4">
            <div className="inline-flex w-fit rounded-full border border-indigo-500/15 bg-indigo-500/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">
              Welcome Faculty
            </div>
            <div className="space-y-2">
              <CardTitle className="text-4xl font-black tracking-tight">Teacher Dashboard</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                Manage your assigned classes, track student attendance, and share academic resources effortlessly.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700" asChild>
              <Link to="/teacher/profile">
                Manage profile
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={UserRound} label="Teacher" value={user?.name || 'Not available'} />
          <InfoCard icon={GraduationCap} label="Rank" value="Senior Faculty" />
          <InfoCard icon={Mail} label="Contact" value={user?.email || 'N/A'} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <InfoCard 
            icon={BookOpen} 
            label="Assigned Classes" 
            value={stats?.assignedClassesCount || 4} 
            color="bg-indigo-500/5 border-indigo-500/10"
        />
        <InfoCard 
            icon={Clock} 
            label="Today's Sessions" 
            value={stats?.upcomingSessionsToday || 3} 
            color="bg-amber-500/5 border-amber-500/10"
        />
        <InfoCard 
            icon={GraduationCap} 
            label="Pending Attendance" 
            value={stats?.attendancePendingCount || 2} 
            color="bg-emerald-500/5 border-emerald-500/10"
        />
        <InfoCard 
            icon={Bell} 
            label="Announcements" 
            value={stats?.noticesCount || 0} 
            color="bg-primary/5 border-primary/10"
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Overview</p>
          <h2 className="text-3xl font-black tracking-tight">Recent Activity</h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
             Your recent assignments and class updates will appear here once connected in Phase 3.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
             <Card key={item} className="border-border/70 shadow-none">
                 <CardHeader className="gap-2">
                    <CardTitle className="text-lg flex justify-between">
                        <span>Mathematics 101</span>
                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">10:00 AM</span>
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-sm text-muted-foreground border-l-2 pl-3 border-primary/40">
                         Remember to upload the study material for Chapter 4 before the end of the day.
                    </p>
                 </CardContent>
             </Card>
            ))}
        </div>
      </section>
    </div>
  );
}
