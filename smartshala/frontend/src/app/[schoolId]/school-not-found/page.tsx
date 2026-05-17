export default function SchoolNotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6">
      <section className="max-w-md rounded-[24px] border border-white/70 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#86868b]">School not found</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#1d1d1f]">This SmartShala workspace is unavailable.</h1>
        <p className="mt-4 text-sm leading-6 text-[#6e6e73]">Check the school ID in the URL or contact the school administrator.</p>
      </section>
    </main>
  );
}
