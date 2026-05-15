"use client";

import { useState } from "react";
import Image from "next/image";
import { LoginForm, type LoginLanguage } from "@/features/auth/LoginForm";

export function LoginShell() {
  const [language, setLanguage] = useState<LoginLanguage>("en");
  const copy = {
    en: {
      headline: <>School operations,<br />ready before assembly.</>,
      intro: "Login for principal and teacher teams. Parents receive WhatsApp updates only.",
      imageTitle: <>Empowering education<br />with clarity and insight.</>,
      imageCaption: "SmartShala Campus ERP - Attendance, Fees, Analytics."
    },
    hi: {
      headline: <>स्कूल संचालन,<br />असेंबली से पहले तैयार.</>,
      intro: "प्रिंसिपल और शिक्षक टीमों के लिए लॉगिन। अभिभावकों को अपडेट WhatsApp पर मिलते हैं।",
      imageTitle: <>स्पष्टता और समझ के साथ<br />शिक्षा को सशक्त बनाएं.</>,
      imageCaption: "SmartShala Campus ERP - उपस्थिति, फीस, एनालिटिक्स."
    }
  }[language];

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <section className="flex items-center justify-center bg-[#f5f5f7] px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0071e3] to-[#34c759]">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">SmartShala</span>
          </div>

          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-[#1d1d1f]">
            {copy.headline}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">
            {copy.intro}
          </p>
          <LoginForm language={language} onLanguageChange={setLanguage} />
        </div>
      </section>

      <section className="relative hidden min-h-screen lg:block">
        <Image
          src="/modern-classroom.png"
          alt="Modern private school classroom"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-[32px] font-semibold leading-tight tracking-tight text-white">
            {copy.imageTitle}
          </p>
          <p className="mt-3 text-[15px] text-white/70">
            {copy.imageCaption}
          </p>
        </div>
      </section>
    </main>
  );
}
