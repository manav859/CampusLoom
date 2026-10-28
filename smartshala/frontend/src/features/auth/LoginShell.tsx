"use client";

import { useRef, useState } from "react";
import { LoginForm, type LoginLanguage } from "@/features/auth/LoginForm";

export function LoginShell() {
  const [language, setLanguage] = useState<LoginLanguage>("en");
  const heroRef = useRef<HTMLElement>(null);

  // The left panel carries a glow that trails the pointer — motion that answers
  // the person rather than looping on its own. Touch devices never fire this.
  function trackPointer(event: React.MouseEvent<HTMLElement>) {
    const panel = heroRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panel.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    panel.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  const copy = {
    en: {
      heroTitle: "Run the whole school from one screen.",
      heroIntro:
        "Admissions, attendance, fees and exams — SmartShala keeps every part of the day in one AI-powered place.",
      coming: "Solis — your AI analyst for the whole school.",
      footer: "© 2026 SmartShala · One platform from admissions to results.",
      welcome: "Welcome back",
      subtitle: "Sign in to continue to your dashboard.",
      tagline: "SmartShala · School ERP"
    },
    hi: {
      heroTitle: "पूरे स्कूल को एक ही स्क्रीन से चलाएँ।",
      heroIntro:
        "प्रवेश, उपस्थिति, फीस और परीक्षा — SmartShala दिन के हर हिस्से को एक AI-संचालित जगह पर रखता है।",
      coming: "Solis — पूरे स्कूल के लिए आपका AI विश्लेषक।",
      footer: "© 2026 SmartShala · प्रवेश से परिणाम तक, एक ही मंच।",
      welcome: "वापसी पर स्वागत है",
      subtitle: "अपने डैशबोर्ड पर जारी रखने के लिए साइन इन करें।",
      tagline: "SmartShala · स्कूल ERP"
    }
  }[language];

  return (
    <main className="relative grid h-[100svh] w-full overflow-hidden bg-white lg:grid-cols-[1.08fr_1fr]" lang={language}>
      <style>{`
        @keyframes ls-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes ls-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        .ls-rise { animation: ls-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ls-float { animation: ls-float 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ls-rise, .ls-float { animation: none !important; }
        }
      `}</style>

      {/* LEFT — brand panel with a product mockup */}
      <section
        ref={heroRef}
        onMouseMove={trackPointer}
        className="relative hidden overflow-hidden bg-gradient-to-br from-[#1b1f6b] via-[#242a86] to-[#2456E6] lg:block"
        style={{ "--mx": "70%", "--my": "25%" } as React.CSSProperties}
      >
        {/* Soft decorative circles */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full bg-white/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute -left-28 bottom-[-140px] h-[380px] w-[380px] rounded-full bg-white/[0.05]" />
        {/* Pointer-tracking highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ background: "radial-gradient(440px circle at var(--mx) var(--my), rgba(120,160,255,0.22), transparent 70%)" }}
        />

        <div className="relative flex h-full flex-col p-10 xl:p-12">
          <div className="ls-rise flex items-center gap-4">
            <img alt="" className="h-14 w-14 rounded-2xl object-contain shadow-lg shadow-black/25" src="/logo-latest.png" />
            <span className="text-[24px] font-semibold tracking-tight text-white">SmartShala</span>
          </div>

          <h2 className="ls-rise mt-9 text-[34px] font-semibold leading-[1.1] tracking-tight text-white xl:text-[40px]" style={{ animationDelay: "0.08s" }}>
            {copy.heroTitle}
          </h2>
          <p className="ls-rise mt-3 max-w-[40ch] text-[15px] leading-relaxed text-white/75" style={{ animationDelay: "0.16s" }}>
            {copy.heroIntro}
          </p>

          {/* Product mockup */}
          <div className="relative mt-9 max-w-[460px]">
            {/* Main attendance card */}
            <div className="ls-rise relative" style={{ animationDelay: "0.24s" }}>
              {/* Floating fees-received pill */}
              <div className="ls-float absolute -top-4 right-4 z-20 flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-xl shadow-black/25">
                <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[12.5px] font-medium text-[#1d1d1f]">Fees received · Class 8-A</span>
                <span className="text-[12.5px] font-semibold text-[#1d1d1f]">₹42,000</span>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-black/30">
                <p className="text-[11px] font-semibold tracking-wide text-[#8a8f98]">ATTENDANCE · TODAY</p>
                <div className="mt-1 flex items-end gap-3">
                  <span className="text-[32px] font-semibold leading-none text-[#1d1d1f]">94%</span>
                  <span className="mb-1 text-[12px] font-semibold text-emerald-600">▲ 3% vs yesterday</span>
                </div>
                <svg viewBox="0 0 320 70" preserveAspectRatio="none" className="mt-3 h-16 w-full" aria-hidden>
                  <defs>
                    <linearGradient id="lsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#2456E6" stopOpacity="0.22" />
                      <stop offset="1" stopColor="#2456E6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,55 C40,52 60,41 100,43 C140,45 160,31 200,27 C240,23 272,18 320,12 L320,70 L0,70 Z" fill="url(#lsArea)" />
                  <path d="M0,55 C40,52 60,41 100,43 C140,45 160,31 200,27 C240,23 272,18 320,12" fill="none" stroke="#2456E6" strokeWidth="2.5" />
                </svg>
                <p className="mt-2 text-[11.5px] text-[#8a8f98]">1,180 of 1,256 students present</p>
              </div>
            </div>

            {/* Two smaller cards */}
            <div className="ls-rise relative mt-4 grid grid-cols-2 gap-4" style={{ animationDelay: "0.32s" }}>
              {/* Admissions funnel */}
              <div className="rounded-2xl bg-white p-4 shadow-xl shadow-black/25">
                <p className="text-[10.5px] font-semibold tracking-wide text-[#8a8f98]">ADMISSIONS FUNNEL</p>
                <div className="mt-3 flex h-[68px] items-stretch gap-2.5">
                  {[
                    { label: "Enquiry", h: "100%", c: "#2456E6" },
                    { label: "Applied", h: "70%", c: "#d4d8e0" },
                    { label: "Offered", h: "45%", c: "#7c6cf0" },
                    { label: "Joined", h: "31%", c: "#10b981" }
                  ].map((bar) => (
                    <div key={bar.label} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-md" style={{ height: bar.h, background: bar.c }} />
                      </div>
                      <span className="text-[9px] font-medium text-[#8a8f98]">{bar.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[#8a8f98]">31% of enquiries enroll</p>
              </div>

              {/* Live staff */}
              <div className="rounded-2xl bg-white p-4 shadow-xl shadow-black/25">
                <div className="flex items-center justify-between">
                  <p className="text-[10.5px] font-semibold tracking-wide text-[#8a8f98]">STAFF</p>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    live
                  </span>
                </div>
                <svg viewBox="0 0 160 60" preserveAspectRatio="none" className="mt-3 h-[52px] w-full" aria-hidden>
                  <path d="M0,46 C25,43 35,20 60,24 C85,28 96,40 120,30 C140,22 150,26 160,16" fill="none" stroke="#2456E6" strokeWidth="2" strokeDasharray="4 4" />
                  <circle cx="60" cy="24" r="3" fill="#2456E6" />
                  <circle cx="160" cy="16" r="3.5" fill="#10b981" />
                </svg>
                <p className="mt-2 text-[11px] text-[#8a8f98]">48 checked in · 6 on leave</p>
              </div>

              {/* Floating gate-entry pill */}
              <div className="ls-float absolute -bottom-4 left-5 z-20 flex items-center gap-2 rounded-full bg-[#eef1ff] px-3.5 py-2 shadow-lg shadow-black/15">
                <svg className="h-3.5 w-3.5 text-[#2456E6]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 2a6 6 0 00-6 6c0 4.2 5.3 9.4 5.6 9.6a.6.6 0 00.8 0C10.7 17.4 16 12.2 16 8a6 6 0 00-6-6zm0 8.2A2.2 2.2 0 1110 5.8a2.2 2.2 0 010 4.4z" clipRule="evenodd" />
                </svg>
                <span className="text-[12px] font-medium text-[#1d1d1f]">Gate entry · Bus 3 arrived</span>
              </div>
            </div>
          </div>

          {/* Coming soon */}
          <div className="ls-rise mt-9 inline-flex w-fit items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm" style={{ animationDelay: "0.42s" }}>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#2456E6]">COMING SOON</span>
            <span className="text-[12.5px] font-medium text-white/85">{copy.coming}</span>
          </div>

          <p className="ls-rise mt-auto pt-8 text-[12px] font-medium text-white/55" style={{ animationDelay: "0.5s" }}>
            {copy.footer}
          </p>
        </div>
      </section>

      {/* RIGHT — white sign-in panel */}
      <section className="relative flex items-center justify-center overflow-y-auto bg-white px-5 py-10 sm:px-10">
        <div className="ls-rise w-full max-w-[416px]" style={{ animationDelay: "0.1s" }}>
          {/* Compact brand lockup — shown on small screens where the left panel is hidden */}
          <div className="mb-8 flex items-center gap-4 lg:hidden">
            <img alt="" className="h-14 w-14 rounded-2xl object-contain shadow-lg shadow-blue-500/25" src="/logo-latest.png" />
            <span className="text-[24px] font-semibold tracking-tight text-[#1d1d1f]">SmartShala</span>
          </div>

          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">{copy.welcome}</h1>
            <p className="mt-2 text-[14px] leading-snug text-[#6e6e73]">{copy.subtitle}</p>
          </div>

          <LoginForm language={language} onLanguageChange={setLanguage} />

          <p className="mt-8 text-[12px] font-medium text-[#a0a7b2]">{copy.tagline}</p>
        </div>
      </section>
    </main>
  );
}
