"use client";

import { useState } from "react";
import { LoginForm, type LoginLanguage } from "@/features/auth/LoginForm";

export function LoginShell() {
  const [language, setLanguage] = useState<LoginLanguage>("en");
  const copy = {
    en: {
      welcome: "Welcome back",
      intro: "Sign in to SmartShala—your all-in-one AI-powered School ERP for admissions, attendance, fees, examinations, communication, and school management.",
      tagline: "Attendance · Fees · Analytics"
    },
    hi: {
      welcome: "वापसी पर स्वागत है",
      intro: "SmartShala में साइन इन करें—प्रवेश, उपस्थिति, फीस, परीक्षा, संचार और स्कूल प्रबंधन के लिए आपका ऑल-इन-वन AI-संचालित स्कूल ERP।",
      tagline: "उपस्थिति · फीस · एनालिटिक्स"
    }
  }[language];

  return (
    <main
      className="relative flex h-[100svh] items-center justify-center overflow-hidden bg-[#eef2fb] px-4 py-4 sm:py-6"
      lang={language}
    >
      {/* Looping video backdrop */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/login-animation.mp4"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
      />
      {/* Dimmed overlay for form readability */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-[#0b1733]/50 via-[#0b1733]/40 to-[#0b1733]/55"
      />
      {/* Soft brand glows */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#2456E6]/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#34c759]/15 blur-3xl" />

      <div className="relative w-full max-w-[440px]">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-7 shadow-[0_24px_70px_-30px_rgba(20,40,90,0.45)] backdrop-blur-xl sm:p-9">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center">
              <img alt="SmartShala" className="h-full w-full object-contain mix-blend-multiply rounded-xl" src="/logo-latest.png" />
            </div>
            <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
              {copy.welcome}
            </h1>
            <p className="mt-1.5 text-[13px] leading-snug text-[#6e6e73]">{copy.intro}</p>
          </div>

          <LoginForm language={language} onLanguageChange={setLanguage} />
        </div>

        <p className="mt-3 text-center text-[12px] font-medium text-[#8a93a6]">{copy.tagline}</p>
      </div>
    </main>
  );
}
