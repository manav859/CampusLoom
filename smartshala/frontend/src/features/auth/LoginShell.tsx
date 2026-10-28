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
        "Admissions, attendance, fees, examinations and communication — SmartShala keeps every part of the day in one AI-powered place.",
      chips: ["Attendance", "Fees", "Examinations", "Communication", "Analytics"],
      welcome: "Welcome back",
      subtitle: "Sign in to continue to your dashboard.",
      tagline: "SmartShala · School ERP"
    },
    hi: {
      heroTitle: "पूरे स्कूल को एक ही स्क्रीन से चलाएँ।",
      heroIntro:
        "प्रवेश, उपस्थिति, फीस, परीक्षा और संचार — SmartShala दिन के हर हिस्से को एक AI-संचालित जगह पर रखता है।",
      chips: ["उपस्थिति", "फीस", "परीक्षा", "संचार", "एनालिटिक्स"],
      welcome: "वापसी पर स्वागत है",
      subtitle: "अपने डैशबोर्ड पर जारी रखने के लिए साइन इन करें।",
      tagline: "SmartShala · स्कूल ERP"
    }
  }[language];

  return (
    <main className="relative grid h-[100svh] w-full overflow-hidden bg-white lg:grid-cols-[1.08fr_1fr]" lang={language}>
      <style>{`
        @keyframes ls-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-18px) } }
        @keyframes ls-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        .ls-rise { animation: ls-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ls-float { animation: ls-float 9s ease-in-out infinite; }
        .ls-chip { animation: ls-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .ls-rise, .ls-float, .ls-chip { animation: none !important; }
        }
      `}</style>

      {/* LEFT — animated brand panel */}
      <section
        ref={heroRef}
        onMouseMove={trackPointer}
        className="relative hidden overflow-hidden lg:block"
        style={{ "--mx": "70%", "--my": "30%" } as React.CSSProperties}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/login-animation.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
        />
        {/* Brand wash keeps white text readable over any video frame */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#0b1733]/85 via-[#122a63]/70 to-[#2456E6]/55" />
        {/* Pointer-tracking highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ background: "radial-gradient(420px circle at var(--mx) var(--my), rgba(90,140,255,0.28), transparent 70%)" }}
        />
        {/* Floating accent */}
        <div aria-hidden className="ls-float pointer-events-none absolute -right-20 top-16 h-72 w-72 rounded-full bg-[#5ac8fa]/20 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="ls-rise flex items-center gap-4">
            <img alt="" className="h-16 w-16 rounded-2xl object-contain shadow-lg shadow-black/25" src="/logo-latest.png" />
            <span className="text-[26px] font-semibold tracking-tight text-white">SmartShala</span>
          </div>

          <div className="max-w-[30ch]">
            <h2 className="ls-rise text-[40px] font-semibold leading-[1.08] tracking-tight text-white xl:text-[46px]" style={{ animationDelay: "0.08s" }}>
              {copy.heroTitle}
            </h2>
            <p className="ls-rise mt-5 text-[15px] leading-relaxed text-white/75" style={{ animationDelay: "0.16s" }}>
              {copy.heroIntro}
            </p>
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {copy.chips.map((chip, index) => (
                <li
                  key={chip}
                  className="ls-chip rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white/90 backdrop-blur-sm"
                  style={{ animationDelay: `${0.24 + index * 0.07}s` }}
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>

          <p className="ls-rise text-[13px] font-medium text-white/55" style={{ animationDelay: "0.6s" }}>
            Trusted by schools for their everyday operations.
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
