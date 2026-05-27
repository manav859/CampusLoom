export default function Home() {
  return (
    <main className="min-h-screen bg-canvas px-6 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-between rounded-[28px] border border-line bg-white p-6 shadow-soft">
        <nav className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand-blue">SmartShala</p>
            <p className="mt-1 text-[13px] font-medium text-muted">Landing site scaffold</p>
          </div>
          <a className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink" href="mailto:hello@smartshala.example">
            Contact
          </a>
        </nav>

        <div className="max-w-3xl py-16">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-brand-mint">Next.js + React ready</p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-normal text-ink sm:text-6xl">
            SmartShala marketing site foundation.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-8 text-muted">
            Project setup is ready for the animated landing page build: sections, scroll effects, hover details, visuals, and conversion flows can be added next.
          </p>
        </div>

        <div className="grid gap-3 text-[13px] font-semibold text-muted sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-canvas p-4">App Router</div>
          <div className="rounded-2xl border border-line bg-canvas p-4">Tailwind CSS</div>
          <div className="rounded-2xl border border-line bg-canvas p-4">Framer Motion</div>
        </div>
      </section>
    </main>
  );
}
