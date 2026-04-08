import { Construction } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';

export default function AdminFeaturePage({
  title,
  description = 'Feature not available yet. The backend module or management UI is still being prepared.',
  icon = Construction,
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Admin module</p>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This page stays stable even when the linked service is not ready. Once the module lands, this route can be upgraded without changing the admin shell.
        </p>
      </div>
      <EmptyState title={title} description={description} icon={icon} />
    </section>
  );
}
