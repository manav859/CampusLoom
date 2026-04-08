import Spinner from '@/components/common/Spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Loading({
  title = 'Loading',
  description = 'Please wait while we prepare this view.',
  fullscreen = false,
  className,
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullscreen ? 'min-h-screen px-6' : 'min-h-[320px] px-4',
        className,
      )}
    >
      <Card className="w-full max-w-lg shadow-none">
        <CardHeader className="items-center text-center">
          <Spinner size="lg" label={title} />
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
