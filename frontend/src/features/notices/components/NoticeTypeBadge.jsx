import { cn } from '@/lib/utils';

const NOTICE_TYPE_STYLES = {
  general: 'bg-secondary text-secondary-foreground ring-1 ring-border',
  exam: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  holiday: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  urgent: 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
};

export default function NoticeTypeBadge({ type, className }) {
  const normalizedType = type || 'general';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em]',
        NOTICE_TYPE_STYLES[normalizedType] || NOTICE_TYPE_STYLES.general,
        className,
      )}
    >
      {normalizedType}
    </span>
  );
}
