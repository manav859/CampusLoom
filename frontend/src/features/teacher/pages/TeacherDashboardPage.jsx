import { Users, BookOpen, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

function InfoCard({ icon, label, value }) {
  const Icon = icon;
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="space-y-1">
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-xl">{value}</CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function TeacherDashboardPage() {
  const { user } = useAuthSession();

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="border-primary/10 bg-[linear-gradient(135deg,rgba(14,116,144,0.08),rgba(14,165,233,0.04),transparent)] shadow-premium flex flex-col justify-between">
          <CardHeader className="space-y-4">
            <div className="inline-flex w-fit rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Welcome Back
            </div>
            <div className="space-y-2">
              <CardTitle className="text-4xl font-black tracking-tight flex items-center gap-3">
                Teacher Portal
              </CardTitle>
              <CardDescription className="max-w-2xl text-base">
                Manage your classes, share study material, track student attendance, and communicate seamlessly from one centralized dashboard.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <Link to="/teacher/profile">
                View profile
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Mock stats for Phase 2 */}
          <InfoCard icon={Users} label="Total Classes Assigned" value="4 Classes" />
          <InfoCard icon={BookOpen} label="Total Students" value="128 Students" />
          <InfoCard icon={Clock} label="Upcoming Classes Today" value="3 Classes" />
          <InfoCard icon={Users} label="Attendance Pending" value="2 Classes" />
        </div>
      </section>

      {/* Quick Actions / Recent Activity Placeholder */}
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
