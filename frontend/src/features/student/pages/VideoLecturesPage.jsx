import { Video, Play, Search, Info, ExternalLink } from 'lucide-react';
import { useStudentLectures } from '../hooks/useStudentQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export default function VideoLecturesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: lectures, isLoading, isError, error, refetch } = useStudentLectures();

  if (isLoading) {
    return <Loading title="Loading Lectures" description="Preparing your video learning sessions..." />;
  }

  if (isError) {
    return (
      <ApiErrorState
        title="Unable to load lectures"
        message={error?.message || 'We could not fetch the video lectures.'}
        onRetry={refetch}
      />
    );
  }

  const filteredLectures = (lectures || []).filter(l => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Video Library</p>
          <h1 className="text-4xl font-black tracking-tight">Recorded Lectures</h1>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search by title or subject..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl h-11 pl-10"
          />
        </div>
      </div>

      {filteredLectures.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No matches found" : "No lectures available"}
          description={searchQuery ? "Try searching for a different subject or topic." : "Recorded video lectures will appear here once your teachers share them."}
          icon={Video}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLectures.map((lecture) => (
            <Card key={lecture.id} className="group overflow-hidden border-border/60 bg-card/30 transition-all hover:bg-card/50 hover:shadow-premium">
              <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                <Video className="size-12 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-300" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="size-14 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
                        <Play className="size-6 fill-current" />
                    </div>
                </div>
              </div>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="rounded-md font-bold text-[10px] uppercase tracking-wider">{lecture.subject}</Badge>
                    <span className="text-[10px] text-muted-foreground font-medium">{new Date(lecture.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-xl leading-snug line-clamp-2 min-h-[3.5rem]">{lecture.title}</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest text-primary/70">
                    Faculty: {lecture.uploadedBy?.name || 'Academic Staff'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full gap-2 rounded-xl" asChild>
                  <a href={lecture.videoUrl} target="_blank" rel="noopener noreferrer">
                    Watch Session
                    <ExternalLink className="size-4" />
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
          Tip: Most video lectures are hosted on secure platforms. Ensure you are logged into your school account if prompted by the video provider.
        </p>
      </div>
    </div>
  );
}
