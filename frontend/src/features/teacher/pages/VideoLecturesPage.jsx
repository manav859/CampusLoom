import { useState } from 'react';
import { Video, Plus, Search, Trash2, Loader2, Link as LinkIcon, X, ExternalLink } from 'lucide-react';
import { useStudentLectures } from '../../student/hooks/useStudentQueries'; // Re-use list hook
import { useCreateLecture, useDeleteLecture } from '../hooks/useTeacherQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const ASSIGNED_CLASSES = ['10-A', '10-B', '11-A', '11-B', '12-A'];

export default function VideoLecturesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: lectures, isLoading, isError, error, refetch } = useStudentLectures();
  const createMutation = useCreateLecture();
  const deleteMutation = useDeleteLecture();

  const handleCreate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      await createMutation.mutateAsync(payload);
      toast.success('Lecture shared successfully');
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to share lecture');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this lecture link?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Lecture deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete lecture');
    }
  };

  if (isLoading) {
    return <Loading title="Loading Lectures" description="Fetching shared video sessions..." />;
  }

  if (isError) {
    return <ApiErrorState title="Error" message={error?.message} onRetry={refetch} />;
  }

  const filteredLectures = (lectures || []).filter(l => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Digital Learning</p>
          <h1 className="text-4xl font-black tracking-tight">Lectures Manager</h1>
        </div>

        <div className="flex gap-2">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                    placeholder="Search sessions..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-xl h-11 pl-10"
                />
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                    <Button className="h-11 gap-2 rounded-xl">
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">Add Session</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Share Video Lecture</DialogTitle>
                        <DialogDescription>
                            Provide a link to a recorded session (Youtube, Vimeo, etc.)
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Title</label>
                            <Input name="title" placeholder="e.g. Quantum Mechanics Part 2" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Subject</label>
                                <Input name="subject" placeholder="e.g. Physics" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Class</label>
                                <Select name="class" required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ASSIGNED_CLASSES.map(cls => (
                                            <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Video URL</label>
                            <Input name="videoUrl" placeholder="https://youtube.com/watch?v=..." type="url" required />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                                {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
                                Share Lecture
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {filteredLectures.length === 0 ? (
        <EmptyState
            title="No lectures shared"
            description="Create your first video lecture link to help students learn remotely."
            icon={Video}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
            {filteredLectures.map((lecture) => (
                <Card key={lecture.id} className="group border-border/60 bg-card/30 shadow-none hover:bg-card/50 transition-colors overflow-hidden">
                    <CardHeader className="flex flex-row items-start justify-between p-6">
                        <div className="flex items-start gap-4">
                            <div className="size-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Video className="size-6" />
                            </div>
                            <div className="space-y-1">
                                <CardTitle className="text-xl line-clamp-1">{lecture.title}</CardTitle>
                                <div className="flex flex-wrap gap-2">
                                     <span className="text-[10px] font-bold uppercase p-1 px-2 bg-primary/10 text-primary rounded-md">{lecture.subject}</span>
                                     <span className="text-[10px] font-bold uppercase p-1 px-2 bg-muted text-muted-foreground rounded-md">{lecture.class}</span>
                                </div>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(lecture.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0">
                        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/50 border border-border/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                                <LinkIcon className="size-3" />
                                <span className="truncate">{lecture.videoUrl}</span>
                            </div>
                            <Button variant="outline" size="sm" asChild className="h-8 rounded-lg">
                                <a href={lecture.videoUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="size-3 mr-1" />
                                    Test
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
