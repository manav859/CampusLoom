import { Link } from 'react-router-dom';
import { Pencil, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import NoticeStatusBadge from './NoticeStatusBadge';
import NoticeTypeBadge from './NoticeTypeBadge';
import { formatNoticeDate } from '../utils';

export default function NoticeTable({
  notices,
  onDelete,
  onToggleStatus,
  deletingNoticeId,
  togglingNoticeId,
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-left">
          <thead className="bg-muted/40">
            <tr className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Publish date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {notices.map((notice) => {
              const isDeleting = deletingNoticeId === notice.id;
              const isToggling = togglingNoticeId === notice.id;

              return (
                <tr key={notice.id} className="align-top">
                  <td className="px-6 py-5">
                    <div className="max-w-sm space-y-2">
                      <div className="font-semibold text-foreground">{notice.title}</div>
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {notice.content}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <NoticeTypeBadge type={notice.type} />
                  </td>
                  <td className="px-6 py-5">
                    <NoticeStatusBadge notice={notice} />
                  </td>
                  <td className="px-6 py-5 text-sm text-muted-foreground">
                    {formatNoticeDate(notice.publishDate)}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/notices/${notice.id}`}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleStatus(notice)}
                        disabled={isToggling}
                      >
                        <Power className="mr-2 size-4" />
                        {notice.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(notice)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CardContent className="border-t bg-muted/20 px-6 py-4 text-sm text-muted-foreground">
        Notices are sorted by publish date. Public visibility also depends on the active flag and expiry window.
      </CardContent>
    </Card>
  );
}
