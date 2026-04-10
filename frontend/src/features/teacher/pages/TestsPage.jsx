import { useState } from 'react';
import { BookOpen, Plus, Search, Trophy, Loader2, Save, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useTeacherTests, useCreateTest, useSubmitResults } from '../hooks/useTeacherQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

const ASSIGNED_CLASSES = ['10-A', '10-B', '11-A', '11-B', '12-A'];

export default function TestsPage() {
  const [selectedClass, setSelectedClass] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gradingTest, setGradingTest] = useState(null); // When a teacher is grading a specific test
  const [gradeData, setGradeData] = useState([]); // List of { studentId, marks }

  const { data: tests, isLoading, isError, error, refetch } = useTeacherTests({ class: selectedClass });
  const createMutation = useCreateTest();
  const submitResultsMutation = useSubmitResults();

  const handleCreateTest = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    payload.maxMarks = Number(payload.maxMarks);

    try {
      await createMutation.mutateAsync(payload);
      toast.success('Test created successfully');
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to create test');
    }
  };

  const startGrading = async (test) => {
    try {
      // Fetch current results and students for this test
      const { data } = await api.get(`/tests/${test.id}`);
      setGradingTest(data.test);
      setGradeData(data.students);
      setGradingTest(test);
      setGradeData(data.students.map(s => ({ studentId: s.id, name: s.name, marks: s.marks ?? '' })));
    } catch (err) {
      toast.error('Failed to load student roster for grading');
    }
  };

  const updateMarks = (studentId, marks) => {
    setGradeData(prev => prev.map(s => s.studentId === studentId ? { ...s, marks } : s));
  };

  const handleSubmitResults = async () => {
    try {
      await submitResultsMutation.mutateAsync({
        testId: gradingTest.id,
        results: gradeData.map(s => ({ studentId: s.studentId, marks: Number(s.marks) })),
      });
      toast.success('Results saved successfully');
      setGradingTest(null);
      refetch();
    } catch (err) {
      toast.error('Failed to save results');
    }
  };

  if (gradingTest) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
           <Button variant="ghost" className="gap-2" onClick={() => setGradingTest(null)}>
             <ArrowLeft className="size-4" />
             Back to Tests
           </Button>
           <Button onClick={handleSubmitResults} disabled={submitResultsMutation.isPending} className="gap-2 shadow-lg">
             {submitResultsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
             Save Results
           </Button>
        </div>

        <div className="space-y-4">
            <h1 className="text-3xl font-black">{gradingTest.title}</h1>
            <div className="flex gap-4">
                 <Badge variant="outline">Class {gradingTest.class}</Badge>
                 <Badge variant="secondary">{gradingTest.subject}</Badge>
                 <Badge variant="outline">Max Marks: {gradingTest.maxMarks}</Badge>
            </div>
        </div>

        <section className="rounded-3xl border border-border/70 bg-card overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground w-1/2">Student Name</th>
                        <th className="p-5 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">Marks Obtained</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {gradeData.map((student) => (
                        <tr key={student.studentId} className="hover:bg-muted/10 transition-colors">
                            <td className="p-5 font-semibold">{student.name}</td>
                            <td className="p-5 flex justify-end">
                                <div className="flex items-center gap-3">
                                    <Input 
                                        type="number" 
                                        className="w-24 text-right rounded-xl font-bold"
                                        max={gradingTest.maxMarks}
                                        min={0}
                                        value={student.marks}
                                        onChange={(e) => updateMarks(student.studentId, e.target.value)}
                                    />
                                    <span className="text-muted-foreground font-bold">/ {gradingTest.maxMarks}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Manager</p>
          <h1 className="text-4xl font-black tracking-tight">Class Tests</h1>
        </div>

        <div className="flex gap-2">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-40 rounded-xl h-11">
                    <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                    {ASSIGNED_CLASSES.map(cls => (
                        <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                    <Button className="h-11 gap-2 rounded-xl">
                        <Plus className="size-4" />
                        Create Test
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Schedule New Test</DialogTitle>
                        <DialogDescription>Add a class test to track student performance.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateTest} className="space-y-4 pt-4">
                        <div className="space-y-2">
                             <label className="text-sm font-semibold">Test Title</label>
                             <Input name="title" placeholder="e.g. Unit Test 1" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Subject</label>
                                <Input name="subject" placeholder="e.g. History" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Class</label>
                                <Select name="class" required>
                                    <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                                    <SelectContent>
                                        {ASSIGNED_CLASSES.map(cls => (
                                            <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Date</label>
                                <Input name="date" type="date" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Max Marks</label>
                                <Input name="maxMarks" type="number" defaultValue={25} required />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                                Create Schedule
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {!selectedClass ? (
        <EmptyState title="Select a class" description="Select a class to manage its scheduled tests and results." icon={BookOpen} />
      ) : isLoading ? (
        <Loading title="Loading Tests" />
      ) : tests.length === 0 ? (
        <EmptyState title="No tests scheduled" description="Use the 'Create Test' button to schedule your first class test." icon={Trophy} />
      ) : (
        <div className="grid gap-4">
            {tests.map((test) => (
                <Card key={test.id} className="border-border/60 bg-card/30 shadow-none hover:bg-card/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between p-6 overflow-hidden">
                        <div className="flex items-center gap-4">
                            <div className="size-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Trophy className="size-6" />
                            </div>
                            <div className="space-y-1">
                                <CardTitle className="text-lg">{test.title}</CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                    <span className="font-bold text-primary/80">{test.subject}</span>
                                    <span>•</span>
                                    <span>{new Date(test.date).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span className="font-bold">{test.maxMarks} Marks</span>
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="outline" className="rounded-xl gap-2 shadow-sm" onClick={() => startGrading(test)}>
                            <CheckCircle2 className="size-4" />
                            Enter Marks
                        </Button>
                    </CardHeader>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
