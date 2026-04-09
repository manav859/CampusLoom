import { useNavigate, useParams } from 'react-router-dom';
import { BellOff } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Loading from '@/components/common/Loading';
import { getErrorMessage } from '@/lib/api';
import NoticeForm from '@/features/notices/components/NoticeForm';
import { useAdminNotice } from '@/features/notices/hooks/useAdminNotice';
import { useUpdateNoticeMutation } from '@/features/notices/hooks/useNoticeMutations';
import { getNoticeFormDefaults } from '@/features/notices/utils';

export default function NoticeEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data, error, isError, isLoading, refetch } = useAdminNotice(id);
  const updateNoticeMutation = useUpdateNoticeMutation();

  const handleUpdateNotice = async (payload) => {
    await updateNoticeMutation.mutateAsync({
      noticeId: id,
      payload,
    });

    navigate('/admin/notices', { replace: true });
  };

  if (isLoading) {
    return <Loading title="Loading notice" description="Preparing the notice editor for this announcement." />;
  }

  if (isError) {
    if (error?.isNotFound) {
      return (
        <EmptyState
          icon={BellOff}
          title="Notice not found"
          description="The requested notice no longer exists or the identifier is invalid."
          actionLabel="Back to notices"
          onAction={() => navigate('/admin/notices', { replace: true })}
        />
      );
    }

    return (
      <ErrorState
        title="Unable to load notice"
        message={getErrorMessage(error)}
        actionLabel="Retry notice"
        onAction={() => refetch()}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={BellOff}
        title="Notice unavailable"
        description="No editable notice data was returned for this request."
        actionLabel="Back to notices"
        onAction={() => navigate('/admin/notices', { replace: true })}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Edit notice</p>
        <h1 className="text-3xl font-black tracking-tight">{data.title}</h1>
      </div>

      <NoticeForm
        key={data.id}
        initialValues={getNoticeFormDefaults(data)}
        onSubmit={handleUpdateNotice}
        isSubmitting={updateNoticeMutation.isPending}
        submitLabel="Save changes"
        serverError={updateNoticeMutation.isError ? getErrorMessage(updateNoticeMutation.error) : ''}
        title="Update notice"
        description="Edit the title, content, or schedule without exposing unfinished changes to the public."
      />
    </section>
  );
}
