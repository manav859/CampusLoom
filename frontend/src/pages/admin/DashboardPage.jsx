import { Users, GraduationCap, FileText, Bell, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const STAT_CARDS = [
  { label: 'Total Students', value: '1,240', icon: GraduationCap, trend: '+12% from last month', color: 'primary' },
  { label: 'Faculty Members', value: '48', icon: Users, trend: '+2 new members', color: 'accent' },
  { label: 'Active Pages', value: '12', icon: FileText, trend: 'All systems operational', color: 'secondary' },
  { label: 'Pending Notices', value: '3', icon: Bell, trend: '2 urgent alerts', color: 'destructive' },
];

/**
 * Admin Dashboard - Modern Overview.
 * Displays high-level metrics with premium card styling and reveal motions.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-10 reveal">
      {/* ─── Hero Banner ─── */}
      <section className="relative overflow-hidden rounded-3xl bg-primary px-8 py-10 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="absolute top-0 right-0 h-full w-1/3 opacity-10 bg-gradient-to-l from-white to-transparent" />
        <div className="relative z-10 space-y-4">
           <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Overview</div>
           <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Good Morning, Admin</h1>
           <p className="max-w-xl text-primary-foreground/70 leading-relaxed">
             Here is what is happening across CampusLoom today. Review your active students, pending notices, and system health.
           </p>
        </div>
      </section>

      {/* ─── Metrics Grid ─── */}
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((stat) => (
          <Card key={stat.label} className="border-none bg-card shadow-sm hover:translate-y-[-2px] hover:shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className={cn("p-2 rounded-xl bg-muted/50 text-muted-foreground")}>
                <stat.icon className="size-5" />
              </div>
              <TrendingUp className="size-4 text-primary opacity-40" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-black tracking-tighter">{stat.value}</div>
              <div className="space-y-1">
                 <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                 <p className="text-[10px] text-primary font-medium">{stat.trend}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ─── Quick Actions / Activity Feed Shell ─── */}
      <section className="grid gap-6 lg:grid-cols-3">
         <Card className="lg:col-span-2 reveal">
            <CardHeader>
               <CardTitle>Recent Enrollment Activity</CardTitle>
               <CardDescription>Visualizing student admissions over the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-64 items-center justify-center rounded-2xl bg-muted/20 text-muted-foreground">
               <p className="text-sm italic opacity-50">Analytics visualization coming soon in Phase 3...</p>
            </CardContent>
         </Card>
         <Card className="reveal">
            <CardHeader>
               <CardTitle>Quick Links</CardTitle>
               <CardDescription>Frequent administrative tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
               {['Create Notice', 'Generate Report', 'Register Faculty', 'System Settings'].map(action => (
                 <button key={action} className="flex w-full items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm font-semibold transition-all hover:bg-primary/10 hover:text-primary">
                    {action}
                    <ArrowRight className="size-4" />
                 </button>
               ))}
            </CardContent>
         </Card>
      </section>
    </div>
  );
}

// Support imports (usually already in context but just in case for a clean write)
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
