import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { noticeFormSchema, noticeTypeOptions } from '../schema';
import { toNoticePayload } from '../utils';

function FieldMessage({ message }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-semibold text-destructive">{message}</p>;
}

export default function NoticeForm({
  initialValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  serverError,
  title,
  description,
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(noticeFormSchema),
    defaultValues: initialValues,
  });

  const submitForm = handleSubmit(async (values) => {
    await onSubmit(toNoticePayload(values));
  });

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Public notices appear only when active, after the publish date, and before the expiry
            date when one is set.
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={submitForm} className="space-y-6">
          {serverError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-semibold" htmlFor="title">
                Title
              </label>
              <Input id="title" placeholder="Quarterly exam schedule update" {...register('title')} />
              <FieldMessage message={errors.title?.message} />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-semibold" htmlFor="content">
                Content
              </label>
              <textarea
                id="content"
                rows={8}
                className="flex min-h-[180px] w-full rounded-xl border border-input bg-transparent px-3 py-3 text-sm outline-none transition-colors focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Write the full announcement exactly as it should appear on the public site."
                {...register('content')}
              />
              <FieldMessage message={errors.content?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="type">
                Type
              </label>
              <select
                id="type"
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition-colors focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register('type')}
              >
                {noticeTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldMessage message={errors.type?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="publishDate">
                Publish date
              </label>
              <Input id="publishDate" type="datetime-local" {...register('publishDate')} />
              <FieldMessage message={errors.publishDate?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="expiryDate">
                Expiry date
              </label>
              <Input id="expiryDate" type="datetime-local" {...register('expiryDate')} />
              <FieldMessage message={errors.expiryDate?.message} />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
              <input id="isActive" type="checkbox" className="size-4 rounded border-border" {...register('isActive')} />
              <div className="space-y-1">
                <label className="text-sm font-semibold" htmlFor="isActive">
                  Notice active
                </label>
                <p className="text-xs text-muted-foreground">
                  Disable this to hide the notice even if its publish window is valid.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/notices">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 size-4" />
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
