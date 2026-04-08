import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function EmptyState({
  title = 'Nothing to show yet',
  description = 'This section will populate once data becomes available.',
  icon = Inbox,
  actionLabel,
  onAction,
}) {
  const IconComponent = icon;

  return (
    <Card className="shadow-none">
      <CardHeader className="items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <IconComponent className="size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex justify-center">
        {onAction ? (
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel || 'Go back'}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
