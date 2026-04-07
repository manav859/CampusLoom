import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CampusLoom brand logo component.
 * Used in navbar, sidebar, and auth pages.
 *
 * @param {object} props
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Logo size variant
 * @param {boolean} [props.showIcon=true] - Show the graduation cap icon
 * @param {string} [props.className] - Additional CSS classes
 */
export default function Logo({ size = 'md', showIcon = true, className }) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const iconSizes = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-6',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <div className="flex items-center justify-center rounded-lg bg-primary p-1.5">
          <GraduationCap className={cn('text-primary-foreground', iconSizes[size])} />
        </div>
      )}
      <span className={cn('font-bold tracking-tight', sizeClasses[size])}>
        Campus<span className="text-primary">Loom</span>
      </span>
    </div>
  );
}
