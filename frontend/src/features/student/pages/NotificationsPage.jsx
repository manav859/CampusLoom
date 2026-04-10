import { Bell, BellOff, Check, CheckCheck, Info } from 'lucide-react';
import { useStudentNotifications, useMarkNotificationRead } from '../hooks/useStudentQueries';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const { data: notifications = [], isLoading, isError, error, refetch } = useStudentNotifications();
  const markReadMutation = useMarkNotificationRead();

  const handleMarkRead = async (id) => {
    try {
      await markReadMutation.mutateAsync(id);
    } catch (err) {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    
    try {
      await Promise.all(unread.map(n => markReadMutation.mutateAsync(n.id)));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Could not mark all as read');
    }
  };

  if (isLoading) {
    return <Loading title="Checking Notifications" description="Looking for recent updates..." />;
  }

  if (isError) {
    return <ApiErrorState title="Error" message={error?.message} onRetry={refetch} />;
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Inbox</p>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white">
                    {unreadCount}
                </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleMarkAllRead} disabled={markReadMutation.isPending}>
                <CheckCheck className="size-4" />
                Mark all as read
            </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="All caught up!"
          description="You don't have any new notifications at the moment."
          icon={BellOff}
        />
      ) : (
        <div className="space-y-4">
            {notifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={cn(
                    "group border-border/60 transition-all hover:shadow-md",
                    !notification.isRead ? "bg-primary/5 border-primary/20" : "bg-card/30 opacity-70"
                  )}
                >
                    <CardHeader className="flex flex-row items-start justify-between p-5 px-6 space-y-0">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "size-10 flex items-center justify-center rounded-xl",
                                !notification.isRead ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                            )}>
                                <Bell className="size-5" />
                            </div>
                            <div className="space-y-1">
                                <CardTitle className="text-lg leading-tight">{notification.title}</CardTitle>
                                <CardDescription className="text-xs font-medium uppercase tracking-widest">
                                    {new Date(notification.createdAt).toLocaleString()}
                                </CardDescription>
                            </div>
                        </div>
                        
                        {!notification.isRead && (
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleMarkRead(notification.id)}
                                className="text-primary hover:bg-primary/10 rounded-full"
                             >
                                <Check className="size-4" />
                             </Button>
                        )}
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0">
                        <p className={cn(
                            "text-sm leading-relaxed",
                            !notification.isRead ? "text-foreground font-medium" : "text-muted-foreground"
                        )}>
                            {notification.message}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary/80">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
            Notifications keep you updated on system alerts, fee reminders, and academic announcements. Unread notifications are highlighted in blue.
        </p>
      </div>
    </div>
  );
}
