import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Loading spinner for data-fetching and suspense states.
 *
 * @param {object} props
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Spinner size
 * @param {string} [props.label] - Accessible loading text
 * @param {string} [props.className] - Additional CSS classes
 */
export default function Spinner({ size = 'md', label = 'Loading...', className }) {
  const sizeClasses = {
    sm: 'size-4',
    md: 'size-6',
    lg: 'size-8',
  };

  return (
    <div className={cn('flex items-center justify-center gap-2', className)} role="status">
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
