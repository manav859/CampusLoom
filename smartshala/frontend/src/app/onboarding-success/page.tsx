import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ schoolId?: string }>;
};

export default async function OnboardingSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const schoolId = params?.schoolId;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6">
      <section className="max-w-lg rounded-[28px] border border-white/70 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#34c759]">Workspace ready</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#1d1d1f]">Your SmartShala school is active.</h1>
        <p className="mt-4 text-sm leading-6 text-[#6e6e73]">School ID: {schoolId ?? "created"}</p>
        {schoolId ? (
          <Link className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[#0071e3] px-6 text-sm font-semibold text-white" href={`/${schoolId}/login`}>
            Open login
          </Link>
        ) : null}
      </section>
    </main>
  );
}
