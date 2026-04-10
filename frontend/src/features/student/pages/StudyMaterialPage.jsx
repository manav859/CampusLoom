import { FileText, Download, Search, Info } from 'lucide-react';
import { useStudentMaterials } from '../hooks/useStudentQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function StudyMaterialPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: materials, isLoading, isError, error, refetch } = useStudentMaterials();

  if (isLoading) {
    return <Loading title="Loading Materials" description="Fetching your class resources..." />;
  }

  if (isError) {
    return (
      <ApiErrorState
        title="Unable to load materials"
        message={error?.message || 'We could not fetch the study materials.'}
        onRetry={refetch}
      />
    );
  }

  const filteredMaterials = (materials || []).filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Resources</p>
          <h1 className="text-4xl font-black tracking-tight">Study Materials</h1>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search materials..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl h-11 pl-10"
          />
        </div>
      </div>

      {filteredMaterials.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matching materials" : "No materials uploaded yet"}
          description={searchQuery ? "Try searching with different keywords." : "Your teachers will upload study materials and notes here for your class."}
          icon={FileText}
          actionLabel={searchQuery ? "Clear search" : null}
          onAction={searchQuery ? () => setSearchQuery('') : null}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMaterials.map((material) => (
            <Card key={material.id} className="group border-border/60 bg-card/30 transition-all hover:bg-card/50 hover:shadow-premium">
              <CardHeader className="space-y-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <FileText className="size-6" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-xl leading-snug line-clamp-1">{material.title}</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest text-primary/70">
                    Uploaded by {material.uploadedBy?.name || 'Teacher'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {material.description || 'No description provided for this material.'}
                </p>
                <Button className="w-full gap-2 rounded-xl" asChild>
                  <a href={`${import.meta.env.VITE_API_BASE_URL}${material.fileUrl}`} target="_blank" rel="noopener noreferrer">
                    <Download className="size-4" />
                    Download PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary/80">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Can't find what you're looking for? Ensure you are checking the materials assigned specifically to your current class section.
        </p>
      </div>
    </div>
  );
}
