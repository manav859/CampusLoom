import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ lead?: string }>;
};

export default async function OnboardingSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lead = params?.lead;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6">
      <section className="max-w-lg rounded-[28px] border border-white/70 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2456E6]">Enquiry received</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#1d1d1f]">Thank you — we will call you shortly.</h1>
        <p className="mt-4 text-sm leading-6 text-[#6e6e73]">
          {lead ? `Your reference is ${lead}. ` : ""}Our team will share a proforma invoice and a secure payment link.
          Your school is set up as soon as the payment arrives.
        </p>
        <Link className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[#0071e3] px-6 text-sm font-semibold text-white" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
