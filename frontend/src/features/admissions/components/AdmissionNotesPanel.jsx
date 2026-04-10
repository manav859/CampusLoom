import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquarePlus, NotebookPen } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { admissionNoteFormSchema } from '../schema';
import { formatAdmissionDate } from '../utils';

function FieldMessage({ message }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-semibold text-destructive">{message}</p>;
}

export default function AdmissionNotesPanel({
  notes,
  onSubmit,
  isSubmitting,
  serverError,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(admissionNoteFormSchema),
    defaultValues: {
      note: '',
    },
  });

  const submitForm = handleSubmit(async (values) => {
    await onSubmit(values.note.trim());
    reset();
  });

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <NotebookPen className="size-5" />
          </div>
          <div>
            <CardTitle>Admissions notes</CardTitle>
            <CardDescription>Track calls, parent conversations, screening outcomes, and follow-up commitments.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={submitForm} className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
          <label className="text-sm font-semibold" htmlFor="note">
            Add internal note
          </label>
          <textarea
            id="note"
            rows={4}
            className="flex min-h-[110px] w-full rounded-xl border border-input bg-transparent px-3 py-3 text-sm outline-none transition-colors focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Called parent at 4:30 PM. Shared fee sheet and requested previous report cards."
            {...register('note')}
          />
          <FieldMessage message={errors.note?.message} />
          {serverError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              <MessageSquarePlus className="mr-2 size-4" />
              Add note
            </Button>
          </div>
        </form>

        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            No internal notes yet. Use notes to capture the real review history for this inquiry.
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{entry.createdBy?.email || 'Admissions staff'}</p>
                    <p className="text-xs text-muted-foreground">{formatAdmissionDate(entry.createdAt)}</p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{entry.note}</p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
