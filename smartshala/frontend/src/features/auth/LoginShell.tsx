"use client";

import { useState } from "react";
import Link from "next/link";
import { LoginForm, type LoginLanguage } from "@/features/auth/LoginForm";

export function LoginShell() {
  const [language, setLanguage] = useState<LoginLanguage>("en");
  const copy = {
    en: {
      welcome: "Welcome back",
      intro: "Sign in to your SmartShala campus. Principal and teacher teams only — parents receive WhatsApp updates.",
      onboardPrompt: "New to SmartShala?",
      onboard: "Onboard your school",
      tagline: "Attendance · Fees · Analytics"
    },
    hi: {
      welcome: "वापसी पर स्वागत है",
      intro: "अपने SmartShala कैंपस में साइन इन करें। केवल प्रिंसिपल और शिक्षक टीमें — अभिभावकों को अपडेट WhatsApp पर मिलते हैं।",
      onboardPrompt: "SmartShala पर नए हैं?",
      onboard: "अपना स्कूल जोड़ें",
      tagline: "उपस्थिति · फीस · एनालिटिक्स"
    }
  }[language];

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef2fb] px-4 py-10"
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

      <div className="relative w-full max-w-[420px]">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_70px_-30px_rgba(20,40,90,0.45)] backdrop-blur-xl sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2456E6] to-[#34c759] shadow-lg shadow-[#2456E6]/25">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="mt-3 text-[15px] font-semibold tracking-tight text-[#1d1d1f]">SmartShala</span>
            <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
              {copy.welcome}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#6e6e73]">{copy.intro}</p>
          </div>

          <LoginForm language={language} onLanguageChange={setLanguage} />

          <div className="mt-7 border-t border-[#e9edf5] pt-5 text-center text-[13px] text-[#6e6e73]">
            {copy.onboardPrompt}{" "}
            <Link className="font-semibold text-[#2456E6] hover:text-[#1B45BD]" href="/onboard">
              {copy.onboard}
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] font-medium text-[#8a93a6]">{copy.tagline}</p>
      </div>
    </main>
  );
}
