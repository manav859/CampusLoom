import { cn } from '@/lib/utils';
import { getNoticeVisibilityState } from '../utils';

export default function NoticeStatusBadge({ notice }) {
  const visibilityState = getNoticeVisibilityState(notice);

  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em]',
          notice?.isActive
            ? 'bg-primary/10 text-primary ring-1 ring-primary/15'
            : 'bg-muted text-muted-foreground ring-1 ring-border',
        )}
      >
        {notice?.isActive ? 'Active' : 'Disabled'}
      </span>
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em]',
          visibilityState.className,
        )}
      >
        {visibilityState.label}
      </span>
    </div>
  );
}
