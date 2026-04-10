import { useState } from 'react';
import { FileText, Plus, Search, Trash2, Loader2, Upload, X } from 'lucide-react';
import { useStudentMaterials } from '../../student/hooks/useStudentQueries'; // Re-use list hook
import { useUploadMaterial } from '../hooks/useTeacherQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const ASSIGNED_CLASSES = ['10-A', '10-B', '11-A', '11-B', '12-A'];

export default function StudyMaterialPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: materials, isLoading, isError, error, refetch } = useStudentMaterials();
  const uploadMutation = useUploadMaterial();

  const handleUpload = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.target);

    try {
      await uploadMutation.mutateAsync(formData);
      toast.success('Study material uploaded successfully');
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to upload material');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return <Loading title="Loading Materials" description="Fetching shared resources..." />;
  }

  if (isError) {
    return <ApiErrorState title="Error" message={error?.message} onRetry={refetch} />;
  }

  const filteredMaterials = (materials || []).filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Faculty Resources</p>
          <h1 className="text-4xl font-black tracking-tight">Study Material Manager</h1>
        </div>

        <div className="flex gap-2">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-xl h-11 pl-10"
                />
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                    <Button className="h-11 gap-2 rounded-xl">
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">Upload New</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Upload Study Material</DialogTitle>
                        <DialogDescription>
                            Share files, notes, or references with your students.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpload} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Title</label>
                            <Input name="title" placeholder="e.g. Chapter 1: Introduction to Physics" required />
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
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Description</label>
                            <Textarea name="description" placeholder="Briefly describe the contents..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">File (PDF/Docs)</label>
                            <Input name="file" type="file" required className="cursor-pointer" />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isUploading} className="gap-2">
                                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                                Upload File
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {filteredMaterials.length === 0 ? (
        <EmptyState
            title="No materials found"
            description="Start by uploading your first study material to share with your assigned classes."
            icon={FileText}
        />
      ) : (
        <div className="grid gap-4">
            {filteredMaterials.map((material) => (
                <Card key={material.id} className="border-border/60 bg-card/30 shadow-none hover:bg-card/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between p-4 px-6">
                        <div className="flex items-center gap-4">
                            <div className="size-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <FileText className="size-5" />
                            </div>
                            <div className="space-y-0.5">
                                <CardTitle className="text-lg">{material.title}</CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                    <span className="font-bold text-primary/80">{material.class}</span>
                                    <span>•</span>
                                    <span>{new Date(material.createdAt).toLocaleDateString()}</span>
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-4" />
                        </Button>
                    </CardHeader>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
