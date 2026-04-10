import { zodResolver } from '@hookform/resolvers/zod';
import { SendHorizontal, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { admissionInquiryFormSchema } from '../schema';
import { toAdmissionInquiryPayload } from '../utils';

function FieldMessage({ message }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-semibold text-destructive">{message}</p>;
}

export default function AdmissionInquiryForm({
  initialValues,
  onSubmit,
  isSubmitting,
  serverError,
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(admissionInquiryFormSchema),
    defaultValues: initialValues,
  });

  const submitForm = handleSubmit(async (values) => {
    await onSubmit(toAdmissionInquiryPayload(values));
  });

  return (
    <Card className="border-primary/10 bg-card/95 shadow-premium">
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle className="text-2xl">Start an admission inquiry</CardTitle>
          <CardDescription>
            Share the student&apos;s details and your preferred class. Our admissions team will review and respond with the next steps.
          </CardDescription>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            This form captures only admission inquiry details. Internal review notes stay inside the
            admin workflow and are never exposed publicly.
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={submitForm} className="space-y-5">
          {serverError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="name">
                Parent / guardian name
              </label>
              <Input id="name" placeholder="Aarav Sharma" {...register('name')} />
              <FieldMessage message={errors.name?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="classLevel">
                Applying for class
              </label>
              <Input id="classLevel" placeholder="Grade 6" {...register('classLevel')} />
              <FieldMessage message={errors.classLevel?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="phone">
                Phone
              </label>
              <Input id="phone" placeholder="+91 98765 43210" {...register('phone')} />
              <FieldMessage message={errors.phone?.message} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="email">
                Email
              </label>
              <Input id="email" type="email" placeholder="family@example.com" {...register('email')} />
              <FieldMessage message={errors.email?.message} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                rows={5}
                className="flex min-h-[132px] w-full rounded-xl border border-input bg-transparent px-3 py-3 text-sm outline-none transition-colors focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Tell us anything relevant: previous school, sibling reference, transport needs, or preferred contact time."
                {...register('message')}
              />
              <FieldMessage message={errors.message?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Required fields help us prevent incomplete or spam inquiries from entering the admissions desk.
            </p>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              <SendHorizontal className="mr-2 size-4" />
              Submit inquiry
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
