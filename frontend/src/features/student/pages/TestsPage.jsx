import { BookOpen, Trophy, AlertCircle, Info } from 'lucide-react';
import { useStudentResults } from '../hooks/useStudentQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function TestsPage() {
  const { data: results = [], isLoading, isError, error, refetch } = useStudentResults();

  if (isLoading) {
    return <Loading title="Loading Results" description="Fetching your latest test scores..." />;
  }

  if (isError) {
    return <ApiErrorState title="Error" message={error?.message} onRetry={refetch} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Academic</p>
        <h1 className="text-4xl font-black tracking-tight">Class Tests & Results</h1>
      </div>

      {results.length === 0 ? (
        <EmptyState
            title="No test results yet"
            description="Your class test scores will appear here once your teachers grade them."
            icon={BookOpen}
        />
      ) : (
        <div className="grid gap-6">
            {results.map((result) => {
                const percentage = Math.round((result.marks / result.maxMarks) * 100);
                const isPassed = percentage >= 40;

                return (
                    <Card key={result.id} className="border-border/60 bg-card/30 shadow-none hover:bg-card/50 transition-colors">
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6">
                            <div className="flex items-start gap-4">
                                <div className={`size-12 flex items-center justify-center rounded-2xl bg-${isPassed ? 'emerald' : 'destructive'}/10 text-${isPassed ? 'emerald' : 'destructive'}`}>
                                    {isPassed ? <Trophy className="size-6" /> : <AlertCircle className="size-6" />}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="rounded-md h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider">{result.subject}</Badge>
                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{new Date(result.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                                    </div>
                                    <CardTitle className="text-xl">{result.testTitle}</CardTitle>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 sm:text-right">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Score</p>
                                    <p className="text-2xl font-black">
                                        {result.marks} <span className="text-sm font-bold text-muted-foreground">/ {result.maxMarks}</span>
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Percentage</p>
                                    <p className={`text-2xl font-black ${isPassed ? 'text-emerald-600' : 'text-destructive'}`}>
                                        {percentage}%
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 pt-0">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <span>Performance Scale</span>
                                    <span>{isPassed ? 'Passed' : 'Needs Improvement'}</span>
                                </div>
                                <Progress value={percentage} className={`h-2 bg-${isPassed ? 'emerald' : 'destructive'}/10`} indicatorClassName={isPassed ? 'bg-emerald-500' : 'bg-destructive'} />
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary/80 max-w-2xl">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>
                    These results are for internal class tests. Final semester reports will be published separately in the Exam Results section.
                </p>
            </div>
        </div>
      )}
    </div>
  );
}
