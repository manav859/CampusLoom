import { BellRing } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Loading from '@/components/common/Loading';
import { getErrorMessage } from '@/lib/api';
import PublicNoticeList from '@/features/notices/components/PublicNoticeList';
import { usePublicNotices } from '@/features/notices/hooks/usePublicNotices';

export default function NoticesPage() {
  const { data, error, isError, isLoading, refetch } = usePublicNotices();
  const notices = Array.isArray(data?.items ?? data) ? data?.items ?? data : [];
  const isFallback = Boolean(data?.meta?.isFallback);

  if (isLoading) {
    return <Loading title="Loading notices" description="Fetching the latest public announcements." />;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <ErrorState
          title="Notices unavailable"
          message={getErrorMessage(error)}
          actionLabel="Retry notices"
          onAction={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12 px-6 py-16 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-5xl space-y-5 text-center">
        <div className="mx-auto inline-flex rounded-full border border-primary/15 bg-primary/5 px-4 py-1 text-xs font-bold uppercase tracking-[0.24em] text-primary">
          School announcements
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Notices and important updates</h1>
        <p className="mx-auto max-w-3xl text-base leading-7 text-muted-foreground">
          Stay informed about exams, holidays, urgent alerts, and school-wide announcements published by the administration.
        </p>
      </section>

      <section className="mx-auto max-w-5xl">
        {notices.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title={isFallback ? 'Notices temporarily unavailable' : 'No notices available'}
            description={
              isFallback
                ? 'The notice service is temporarily unavailable. This safe fallback prevents the public site from breaking.'
                : 'There are no active notices right now. Check back later for the latest announcements.'
            }
            actionLabel="Retry notices"
            onAction={() => refetch()}
          />
        ) : (
          <PublicNoticeList notices={notices} />
        )}
      </section>
    </div>
  );
}
