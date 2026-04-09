import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Plus } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Loading from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api';
import NoticeTable from '@/features/notices/components/NoticeTable';
import { useAdminNotices } from '@/features/notices/hooks/useAdminNotices';
import {
  useDeleteNoticeMutation,
  useUpdateNoticeStatusMutation,
} from '@/features/notices/hooks/useNoticeMutations';

export default function NoticesPage() {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState('');
  const { data, error, isError, isLoading, refetch } = useAdminNotices();
  const deleteNoticeMutation = useDeleteNoticeMutation();
  const updateNoticeStatusMutation = useUpdateNoticeStatusMutation();
  const notices = Array.isArray(data) ? data : [];

  const handleDelete = async (notice) => {
    const confirmed = window.confirm(`Delete notice "${notice.title}"? This action cannot be undone.`);

    if (!confirmed) {
      return;
    }

    try {
      setActionError('');
      await deleteNoticeMutation.mutateAsync(notice.id);
    } catch (mutationError) {
      setActionError(getErrorMessage(mutationError));
    }
  };

  const handleToggleStatus = async (notice) => {
    try {
      setActionError('');
      await updateNoticeStatusMutation.mutateAsync({
        noticeId: notice.id,
        isActive: !notice.isActive,
      });
    } catch (mutationError) {
      setActionError(getErrorMessage(mutationError));
    }
  };

  if (isLoading) {
    return <Loading title="Loading notices" description="Fetching the announcement registry for the admin panel." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Notices unavailable"
        message={getErrorMessage(error)}
        actionLabel="Retry notices"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Admin notices</p>
          <h1 className="text-3xl font-black tracking-tight">Publish and manage announcements</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Control school-wide communication from one place. Active notices flow to the public site automatically when their schedule is valid.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/notices/new">
            <Plus className="mr-2 size-4" />
            New notice
          </Link>
        </Button>
      </div>

      {actionError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      {notices.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notices published yet"
          description="Create the first announcement to populate both the admin panel and the public notices page."
          actionLabel="Create first notice"
          onAction={() => navigate('/admin/notices/new')}
        />
      ) : (
        <NoticeTable
          notices={notices}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          deletingNoticeId={deleteNoticeMutation.variables}
          togglingNoticeId={updateNoticeStatusMutation.variables?.noticeId}
        />
      )}
    </section>
  );
}
