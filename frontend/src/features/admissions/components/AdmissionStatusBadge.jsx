import { cn } from '@/lib/utils';
import { getAdmissionStatusMeta } from '../utils';

export default function AdmissionStatusBadge({ status }) {
  const meta = getAdmissionStatusMeta(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}
