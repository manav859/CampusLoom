import { useStudentDashboard } from '../hooks/useStudentQueries';

const roleLabels = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
};

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

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  
  const { 
    data: stats, 
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats 
  } = useStudentDashboard();

  const {
    data: admissions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useCurrentUserAdmissions();

  const {
    data: results = [],
    isLoading: resultsLoading,
    isError: resultsError,
    error: resultsErr,
    refetch: refetchResults,
  } = useCurrentUserResults();

  if (isLoading || statsLoading) {
    return <Loading title="Loading your dashboard" description="Gathering your latest data..." />;
  }

  if (isError || statsError) {
    return (
      <ApiErrorState
        title="Unable to load dashboard"
        message={error?.message || 'We could not load your dashboard right now.'}
        onRetry={() => { refetch(); refetchStats(); }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="border-primary/10 bg-[linear-gradient(135deg,rgba(14,116,144,0.08),rgba(14,165,233,0.04),transparent)] shadow-premium">
          <CardHeader className="space-y-4">
            <div className="inline-flex w-fit rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Welcome Back
            </div>
            <div className="space-y-2">
              <CardTitle className="text-4xl font-black tracking-tight">Student Portal</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                Welcome to your academic home. You are currently enrolled in <span className="font-bold text-primary">Class {stats?.class || 'Pending'}</span>.
                Explore your progress below.
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

        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={UserRound} label="Name" value={user?.name || 'Not available'} />
          <InfoCard icon={GraduationCap} label="Role" value={roleLabels[user?.role] || 'User'} />
          <InfoCard icon={BookOpen} label="Enrolled Class" value={stats?.class || 'N/A'} />
        </div>
      </section>

      {/* Real dashboard stats */}
      <section className="grid gap-4 sm:grid-cols-3">
        <InfoCard 
            icon={BookOpen} 
            label="Total Notices" 
            value={stats?.noticesCount || 0} 
            color="bg-amber-500/5 border-amber-500/10"
        />
        <InfoCard 
            icon={Clock} 
            label="Upcoming Tests" 
            value={stats?.upcomingTestsCount || 0} 
            color="bg-primary/5 border-primary/10"
        />
        <InfoCard 
            icon={GraduationCap} 
            label="Attendance %" 
            value={`${stats?.attendancePercentage || 0}%`} 
            color="bg-emerald-500/5 border-emerald-500/10"
        />
      </section>

      {/* My Results Section */}
      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Academic</p>
          <h2 className="text-3xl font-black tracking-tight">My Recent Results</h2>
        </div>

        {resultsLoading ? (
          <Loading title="Loading results" description="Fetching your exam results..." />
        ) : resultsError ? (
          <ApiErrorState
            title="Unable to load results"
            message={resultsErr?.message || 'We could not load your results right now.'}
            onRetry={() => refetchResults()}
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No results available yet"
            description="Your exam results will appear here once they are published by the administration."
            icon={BookOpen}
          />
        ) : (
          <ResultsTable results={results} />
        )}
      </section>

      {/* Linked Admissions Section */}
      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Admissions</p>
          <h2 className="text-3xl font-black tracking-tight">Your linked admissions</h2>
        </div>

        {admissions.length === 0 ? (
          <EmptyState
            title="No admissions linked yet"
            description="Submit an admission inquiry while signed in and it will appear here automatically."
            icon={GraduationCap}
            actionLabel="Go to admissions"
            onAction={() => navigate('/admissions')}
          />
        ) : (
          <div className="grid gap-5">
            {admissions.map((admission) => (
              <Card key={admission.id} className="border-border/70 shadow-none">
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl">{admission.name}</CardTitle>
                    <CardDescription>
                      Inquiry {admission.id.slice(-6).toUpperCase()} - Submitted {formatAdmissionDate(admission.createdAt)}
                    </CardDescription>
                  </div>
                  <AdmissionStatusBadge status={admission.status} />
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Class</p>
                    <p className="mt-2 font-semibold">{admission.class}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Contact</p>
                    <p className="mt-2 font-semibold">{admission.email}</p>
                    <p className="text-sm text-muted-foreground">{admission.phone}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Last updated</p>
                    <p className="mt-2 font-semibold">{formatAdmissionDate(admission.updatedAt)}</p>
                  </div>
                  {admission.message ? (
                    <div className="rounded-2xl border border-border bg-muted/20 p-4 md:col-span-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Message</p>
                      <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground/85">{admission.message}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
