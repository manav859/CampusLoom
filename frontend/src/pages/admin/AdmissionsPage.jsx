import { useState } from 'react';
import { GraduationCap, SearchCheck, UserRoundPlus, UserRoundX } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Loading from '@/components/common/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdmissionsTable from '@/features/admissions/components/AdmissionsTable';
import { admissionStatusOptions } from '@/features/admissions/api';
import { useAdminAdmissions } from '@/features/admissions/hooks/useAdminAdmissions';
import { filterAdmissionsByStatus, getAdmissionStats } from '@/features/admissions/utils';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const filterOptions = [{ label: 'All', value: 'all' }, ...admissionStatusOptions];

const statCards = [
  { key: 'new', title: 'New inquiries', icon: UserRoundPlus },
  { key: 'inReview', title: 'In review', icon: SearchCheck },
  { key: 'approved', title: 'Approved', icon: GraduationCap },
  { key: 'rejected', title: 'Rejected', icon: UserRoundX },
];

export default function AdmissionsPage() {
  const [activeStatus, setActiveStatus] = useState('all');
  const { data, error, isError, isLoading, refetch } = useAdminAdmissions();
  const admissions = Array.isArray(data) ? data : [];
  const stats = getAdmissionStats(admissions);
  const filteredAdmissions = filterAdmissionsByStatus(admissions, activeStatus);

  if (isLoading) {
    return <Loading title="Loading admissions" description="Preparing the admissions queue for review." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Admissions unavailable"
        message={getErrorMessage(error)}
        actionLabel="Retry admissions"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Admissions desk</p>
        <h1 className="text-3xl font-black tracking-tight">Review incoming admission inquiries</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This queue is the operational view for the admissions team: screen new families, move cases through review, and keep every follow-up note inside the record.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key} className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight">{stats[card.key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setActiveStatus(option.value)}
            className={cn(
              'inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              activeStatus === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {admissions.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No admissions inquiries yet"
          description="New public submissions will appear here automatically once families start using the admissions form."
        />
      ) : filteredAdmissions.length === 0 ? (
        <EmptyState
          icon={SearchCheck}
          title="No inquiries in this status"
          description="Try a different filter to view the rest of the admissions pipeline."
        />
      ) : (
        <AdmissionsTable admissions={filteredAdmissions} />
      )}
    </section>
  );
}
