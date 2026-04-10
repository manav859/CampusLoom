import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, FileSearch, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdmissionInquiryForm from '@/features/admissions/components/AdmissionInquiryForm';
import { useCreateAdmissionInquiryMutation } from '@/features/admissions/hooks/useAdmissionMutations';
import { getAdmissionInquiryDefaults } from '@/features/admissions/utils';
import { getErrorMessage } from '@/lib/api';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

const workflowSteps = [
  {
    icon: FileSearch,
    title: 'Inquiry received',
    description: 'Your family details enter the admissions desk instantly, with validation that keeps the workflow clean and review-ready.',
  },
  {
    icon: Clock3,
    title: 'Review and screening',
    description: 'Our team checks the requested class, captures internal review notes, and contacts you for the next step.',
  },
  {
    icon: UserRoundCheck,
    title: 'Decision and onboarding',
    description: 'Qualified applicants move to approval and onboarding with a clear admissions status trail.',
  },
];

const highlights = [
  'Structured inquiry intake for every class level',
  'Admissions-team review with internal notes and status updates',
  'Safe validation to block incomplete or low-quality submissions',
];

import { getRoleHome } from '@/features/auth/utils';

export default function AdmissionsPage() {
  const [submissionState, setSubmissionState] = useState(null);
  const createAdmissionMutation = useCreateAdmissionInquiryMutation();
  const { isAuthenticated, user } = useAuthSession();

  const initialValues = {
    ...getAdmissionInquiryDefaults(),
    name: user?.name || '',
    email: user?.email || '',
  };

  const handleSubmitInquiry = async (payload) => {
    const response = await createAdmissionMutation.mutateAsync(payload);
    setSubmissionState(response);
  };

  return (
    <div className="space-y-20 pb-24">
      {/* ... keep content same until button ... */}
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_28%),linear-gradient(135deg,oklch(0.28_0.1_265),oklch(0.42_0.15_255))] px-6 py-20 text-primary-foreground">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.04),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em]">
              Admissions workflow
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Begin the application journey with a real admissions desk behind it.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-primary-foreground/75">
                CampusLoom handles admission inquiries as an operational workflow, not a dead-end contact form. Submit your details and our team can review, track, and follow up with clarity.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-white/12 bg-white/8 px-4 py-4 text-sm leading-6 text-primary-foreground/85">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:pl-8">
            {submissionState ? (
              <Card className="border-emerald-200 bg-white text-foreground shadow-premium">
                <CardHeader className="space-y-3">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl">Inquiry submitted</CardTitle>
                    <CardDescription>
                      The admissions desk has received your request. Keep a note of this reference while our team reviews the next step.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Reference</p>
                      <p className="mt-2 text-lg font-semibold">{submissionState.id}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Initial status</p>
                      <p className="mt-2 text-lg font-semibold capitalize">{submissionState.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <p>
                      We will contact you after internal review. If you need to submit another inquiry, please wait a short while to avoid duplicate spam protection.
                    </p>
                  </div>
                  {isAuthenticated ? (
                    <Button variant="outline" asChild>
                      <Link to={getRoleHome(user.role)}>View in My Account</Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <AdmissionInquiryForm
                key={user?.id ?? 'guest'}
                initialValues={initialValues}
                onSubmit={handleSubmitInquiry}
                isSubmitting={createAdmissionMutation.isPending}
                serverError={createAdmissionMutation.isError ? getErrorMessage(createAdmissionMutation.error) : ''}
              />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6">
        <div className="mb-10 space-y-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">How it works</p>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">A school workflow, not just a website form</h2>
          <p className="mx-auto max-w-3xl text-base leading-7 text-muted-foreground">
            Each inquiry moves through a structured review flow so the admissions team can act with context instead of sorting through loose messages.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <Card key={step.title} className="border-border/80 shadow-none">
              <CardHeader className="space-y-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="size-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Step {index + 1}</p>
                  <CardTitle className="text-2xl">{step.title}</CardTitle>
                  <CardDescription className="text-base">{step.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
