import { useState } from 'react';
import { BellOff, Mail, Phone } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Loading from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { admissionStatusOptions } from '@/features/admissions/api';
import AdmissionNotesPanel from '@/features/admissions/components/AdmissionNotesPanel';
import AdmissionStatusBadge from '@/features/admissions/components/AdmissionStatusBadge';
import { useAdminAdmission } from '@/features/admissions/hooks/useAdminAdmission';
import {
  useCreateAdmissionNoteMutation,
  useUpdateAdmissionStatusMutation,
} from '@/features/admissions/hooks/useAdmissionMutations';
import { formatAdmissionDate } from '@/features/admissions/utils';
import { getErrorMessage } from '@/lib/api';

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}

export default function AdmissionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [statusValue, setStatusValue] = useState(null);
  const [statusError, setStatusError] = useState('');
  const { data, error, isError, isLoading, refetch } = useAdminAdmission(id);
  const updateStatusMutation = useUpdateAdmissionStatusMutation();
  const createNoteMutation = useCreateAdmissionNoteMutation();
  const currentStatus = statusValue ?? data?.status ?? 'new';

  const handleStatusUpdate = async () => {
    try {
      setStatusError('');
      await updateStatusMutation.mutateAsync({
        admissionId: id,
        status: currentStatus,
      });
    } catch (mutationError) {
      setStatusError(getErrorMessage(mutationError));
    }
  };

  const handleNoteSubmit = async (note) => {
    await createNoteMutation.mutateAsync({
      admissionId: id,
      note,
    });
  };

  if (isLoading) {
    return <Loading title="Loading inquiry" description="Preparing the admissions record and note history." />;
  }

  if (isError) {
    if (error?.isNotFound) {
      return (
        <EmptyState
          icon={BellOff}
          title="Admission not found"
          description="This inquiry no longer exists or the identifier is invalid."
          actionLabel="Back to admissions"
          onAction={() => navigate('/admin/admissions', { replace: true })}
        />
      );
    }

    return (
      <ErrorState
        title="Unable to load inquiry"
        message={getErrorMessage(error)}
        actionLabel="Retry inquiry"
        onAction={() => refetch()}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={BellOff}
        title="Admission unavailable"
        description="No admissions detail was returned for this request."
        actionLabel="Back to admissions"
        onAction={() => navigate('/admin/admissions', { replace: true })}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Admission detail</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">{data.name}</h1>
            <AdmissionStatusBadge status={data.status} />
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Review the inquiry, update the decision status, and leave a clear internal trail for the admissions team.
          </p>
        </div>

        <Button variant="outline" onClick={() => navigate('/admin/admissions')}>
          Back to admissions
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle>Inquiry profile</CardTitle>
            <CardDescription>Core student and parent contact data captured from the public admissions form.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailRow label="Submitted">{formatAdmissionDate(data.createdAt)}</DetailRow>
            <DetailRow label="Updated">{formatAdmissionDate(data.updatedAt)}</DetailRow>
            <DetailRow label="Class">{data.class}</DetailRow>
            <DetailRow label="Phone">
              <a href={`tel:${data.phone}`} className="inline-flex items-center gap-2 font-medium hover:text-primary">
                <Phone className="size-4" />
                {data.phone}
              </a>
            </DetailRow>
            <DetailRow label="Email">
              <a href={`mailto:${data.email}`} className="inline-flex items-center gap-2 font-medium hover:text-primary">
                <Mail className="size-4" />
                {data.email}
              </a>
            </DetailRow>
            <DetailRow label="Message">
              {data.message ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">{data.message}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No extra message submitted.</p>
              )}
            </DetailRow>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle>Workflow status</CardTitle>
            <CardDescription>Move the inquiry through your admissions pipeline without losing the review context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="status">
                Current stage
              </label>
              <select
                id="status"
                className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition-colors focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={currentStatus}
                onChange={(event) => setStatusValue(event.target.value)}
              >
                {admissionStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {statusError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {statusError}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Use <span className="font-semibold text-foreground">In Review</span> for active screening, <span className="font-semibold text-foreground">Approved</span> once the seat is confirmed, and <span className="font-semibold text-foreground">Rejected</span> for closed outcomes.
            </div>

            <Button
              type="button"
              onClick={handleStatusUpdate}
              disabled={updateStatusMutation.isPending || currentStatus === data.status}
            >
              Save status
            </Button>
          </CardContent>
        </Card>
      </div>

      <AdmissionNotesPanel
        notes={Array.isArray(data.notes) ? data.notes : []}
        onSubmit={handleNoteSubmit}
        isSubmitting={createNoteMutation.isPending}
        serverError={createNoteMutation.isError ? getErrorMessage(createNoteMutation.error) : ''}
      />
    </section>
  );
}
