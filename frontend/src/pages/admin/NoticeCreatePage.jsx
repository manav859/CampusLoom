import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '@/lib/api';
import NoticeForm from '@/features/notices/components/NoticeForm';
import { useCreateNoticeMutation } from '@/features/notices/hooks/useNoticeMutations';
import { getNoticeFormDefaults } from '@/features/notices/utils';

export default function NoticeCreatePage() {
  const navigate = useNavigate();
  const createNoticeMutation = useCreateNoticeMutation();

  const handleCreateNotice = async (payload) => {
    await createNoticeMutation.mutateAsync(payload);
    navigate('/admin/notices', { replace: true });
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Create notice</p>
        <h1 className="text-3xl font-black tracking-tight">Publish a new announcement</h1>
      </div>

      <NoticeForm
        initialValues={getNoticeFormDefaults()}
        onSubmit={handleCreateNotice}
        isSubmitting={createNoticeMutation.isPending}
        submitLabel="Create notice"
        serverError={createNoticeMutation.isError ? getErrorMessage(createNoticeMutation.error) : ''}
        title="Notice details"
        description="Define the message, category, and publishing schedule before making this announcement live."
      />
    </section>
  );
}
