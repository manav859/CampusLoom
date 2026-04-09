import { AlertTriangle, BellRing } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import NoticeTypeBadge from './NoticeTypeBadge';
import { formatNoticeDate } from '../utils';

export default function PublicNoticeList({ notices }) {
  return (
    <div className="grid gap-6">
      {notices.map((notice) => {
        const isUrgent = notice.type === 'urgent';

        return (
          <Card
            key={notice.id}
            className={isUrgent ? 'border-destructive/20 bg-destructive/5 shadow-none' : 'shadow-none'}
          >
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={
                      isUrgent
                        ? 'flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive'
                        : 'flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary'
                    }
                  >
                    {isUrgent ? <AlertTriangle className="size-5" /> : <BellRing className="size-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{notice.title}</CardTitle>
                    <CardDescription>{formatNoticeDate(notice.publishDate)}</CardDescription>
                  </div>
                </div>
                <NoticeTypeBadge type={notice.type} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{notice.content}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
