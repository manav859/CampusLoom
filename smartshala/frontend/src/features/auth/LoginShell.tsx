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
      footer: "© 2026 SmartShala · One platform from admissions to results.",
      welcome: "Welcome back",
      subtitle: "Sign in to continue to your dashboard.",
      tagline: "SmartShala · School ERP"
    },
    hi: {
      heroTitle: "पूरे स्कूल को एक ही स्क्रीन से चलाएँ।",
      heroIntro:
        "प्रवेश, उपस्थिति, फीस और परीक्षा — SmartShala दिन के हर हिस्से को एक AI-संचालित जगह पर रखता है।",
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
        className="relative hidden overflow-hidden bg-[#14318C] lg:block"
        style={{ "--mx": "70%", "--my": "25%" } as React.CSSProperties}
      >
        {/* Looping brand video behind everything */}
        <video
          className="absolute inset-0 h-full w-full object-fill"
          src="/login-animation.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
        />
        {/* Blue shade keeps white text and the mockup readable over any frame */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#14318C]/90 via-[#1B45BD]/80 to-[#2456E6]/65" />
        {/* Soft decorative circles */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full bg-white/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute -left-28 bottom-[-140px] h-[380px] w-[380px] rounded-full bg-white/[0.05]" />
        {/* Pointer-tracking highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ background: "radial-gradient(440px circle at var(--mx) var(--my), rgba(120,160,255,0.22), transparent 70%)" }}
        />

        <div className="relative flex h-full flex-col items-center justify-center p-8 xl:p-10">
          <h2 className="ls-rise text-center text-[28px] font-semibold leading-[1.1] tracking-tight text-white xl:text-[32px]" style={{ animationDelay: "0.08s" }}>
            {copy.heroTitle}
          </h2>
          <p className="ls-rise mt-3 max-w-[42ch] text-center text-[14px] leading-relaxed text-white/75" style={{ animationDelay: "0.16s" }}>
            {copy.heroIntro}
          </p>

          {/* Product mockup */}
          <div className="relative mt-7 max-w-[460px]">
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

              <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-black/30">
                <p className="text-[11px] font-semibold tracking-wide text-[#8a8f98]">ATTENDANCE · TODAY</p>
                <div className="mt-1 flex items-end gap-3">
                  <span className="text-[28px] font-semibold leading-none text-[#1d1d1f]">94%</span>
                  <span className="mb-1 text-[12px] font-semibold text-emerald-600">▲ 3% vs yesterday</span>
                </div>
                <svg viewBox="0 0 320 70" preserveAspectRatio="none" className="mt-3 h-14 w-full" aria-hidden>
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
              {/* Fee collection */}
              <div className="rounded-2xl bg-white p-4 shadow-xl shadow-black/25">
                <p className="text-[10.5px] font-semibold tracking-wide text-[#8a8f98]">FEE COLLECTION</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0">
                    <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
                      <circle cx="28" cy="28" r="22" fill="none" stroke="#eceef3" strokeWidth="7" />
                      <circle cx="28" cy="28" r="22" fill="none" stroke="#2456E6" strokeWidth="7" strokeLinecap="round" strokeDasharray="138.2" strokeDashoffset="24.9" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-[#1d1d1f]">82%</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">₹8.4L</p>
                    <p className="text-[10.5px] text-[#8a8f98]">of ₹10.2L · Term 2</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-[#8a8f98]">₹1.8L pending</p>
              </div>

              {/* Results */}
              <div className="rounded-2xl bg-white p-4 shadow-xl shadow-black/25">
                <div className="flex items-center justify-between">
                  <p className="text-[10.5px] font-semibold tracking-wide text-[#8a8f98]">RESULTS</p>
                  <span className="text-[10.5px] font-semibold text-emerald-600">▲ 4%</span>
                </div>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-[22px] font-semibold leading-none text-[#1d1d1f]">78%</span>
                  <span className="mb-0.5 text-[10.5px] text-[#8a8f98]">class avg</span>
                </div>
                <svg viewBox="0 0 160 44" preserveAspectRatio="none" className="mt-2 h-10 w-full" aria-hidden>
                  <defs>
                    <linearGradient id="lsRes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#10b981" stopOpacity="0.22" />
                      <stop offset="1" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,32 C25,30 35,24 60,22 C85,20 95,26 120,17 C140,11 150,13 160,8 L160,44 L0,44 Z" fill="url(#lsRes)" />
                  <path d="M0,32 C25,30 35,24 60,22 C85,20 95,26 120,17 C140,11 150,13 160,8" fill="none" stroke="#10b981" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>

          <p className="ls-rise absolute inset-x-8 bottom-6 text-center text-[12px] font-medium text-white/55 xl:inset-x-10 xl:bottom-8" style={{ animationDelay: "0.5s" }}>
            {copy.footer}
          </p>
        </div>
      </section>

      {/* RIGHT — white sign-in panel */}
      <section className="relative flex items-center justify-center overflow-y-auto bg-white px-5 py-10 sm:px-10">
        <div className="ls-rise w-full max-w-[416px]" style={{ animationDelay: "0.1s" }}>
          {/* Brand lockup */}
          <div className="mb-8 flex items-center gap-4">
            <img alt="" className="h-14 w-14 rounded-lg object-contain shadow-lg shadow-blue-500/25" src="/logo-latest.png" />
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
