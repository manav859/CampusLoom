import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ErrorState({
  title = 'Unable to load this section',
  message = 'Something went wrong while preparing this page.',
  actionLabel = 'Try again',
  onAction,
}) {
  return (
    <Card className="border-destructive/20 bg-destructive/5 shadow-none">
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-destructive/80">{message}</CardDescription>
        </div>
      </CardHeader>
      {onAction ? (
        <CardContent>
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel} <RefreshCcw className="ml-2 size-4" />
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
