"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
      headline: (
        <>
          <span lang="hi">{"\u0938\u094D\u0915\u0942\u0932 \u0938\u0902\u091A\u093E\u0932\u0928,"}</span>
          <br />
          <span lang="hi">{"\u0905\u0938\u0947\u0902\u092C\u0932\u0940 \u0938\u0947 \u092A\u0939\u0932\u0947 \u0924\u0948\u092F\u093E\u0930."}</span>
        </>
      ),
      intro: "\u092A\u094D\u0930\u093F\u0902\u0938\u093F\u092A\u0932 \u0914\u0930 \u0936\u093F\u0915\u094D\u0937\u0915 \u091F\u0940\u092E\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F \u0932\u0949\u0917\u093F\u0928\u0964 \u0905\u092D\u093F\u092D\u093E\u0935\u0915\u094B\u0902 \u0915\u094B \u0905\u092A\u0921\u0947\u091F WhatsApp \u092A\u0930 \u092E\u093F\u0932\u0924\u0947 \u0939\u0948\u0902\u0964",
      imageTitle: (
        <>
          <span lang="hi">{"\u0938\u094D\u092A\u0937\u094D\u091F\u0924\u093E \u0914\u0930 \u0938\u092E\u091D \u0915\u0947 \u0938\u093E\u0925"}</span>
          <br />
          <span lang="hi">{"\u0936\u093F\u0915\u094D\u0937\u093E \u0915\u094B \u0938\u0936\u0915\u094D\u0924 \u092C\u0928\u093E\u090F\u0902."}</span>
        </>
      ),
      imageCaption: "SmartShala Campus ERP - \u0909\u092A\u0938\u094D\u0925\u093F\u0924\u093F, \u092B\u0940\u0938, \u090F\u0928\u093E\u0932\u093F\u091F\u093F\u0915\u094D\u0938."
    }
  }[language];

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]" lang={language}>
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

          <h1 className="text-[34px] font-semibold leading-[1.18] tracking-normal text-[#1d1d1f]">
            {copy.headline}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">
            {copy.intro}
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-[#d2d2d7] bg-white px-5 text-[14px] font-semibold text-[#0071e3] shadow-sm transition hover:border-[#0071e3]/30 hover:bg-[#f5faff]"
            href="/onboard"
          >
            Onboard your school
          </Link>
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
          <p className="text-[32px] font-semibold leading-[1.18] tracking-normal text-white">
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
