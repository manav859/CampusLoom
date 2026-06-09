"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TutorialModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type TutorialStep = {
  key: string;
  title: string;
  description: string;
  tip: string;
  accent: string;
  accentSoft: string;
  illustration: ReactNode;
};

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

/* ── Step illustrations (looping, lightweight CSS animations) ── */

function WelcomeIllustration() {
  return (
    <div className="w-[230px] rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0071e3]">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-24 rounded-full bg-[#1d1d1f]/75" />
          <div className="h-1.5 w-16 rounded-full bg-[#86868b]/50" />
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {["#0071e3", "#34c759", "#ff9500"].map((color, i) => (
          <div key={color} className="animate-tut-float rounded-lg bg-[#F4F7FC] p-2" style={{ animationDelay: `${i * 0.25}s` }}>
            <div className="h-3 w-3 rounded-full" style={{ background: color }} />
            <div className="mt-2 h-1.5 w-full rounded-full bg-[#D7DEE8]" />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-end gap-1.5 rounded-lg bg-[#F4F7FC] p-2.5">
        {[10, 18, 13, 22, 16].map((h, i) => (
          <div key={i} className="flex-1 origin-bottom animate-tut-bar rounded-sm bg-[#9CC2F5]" style={{ height: h, animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
    </div>
  );
}

function AttendanceIllustration() {
  const rows = ["#0071e3", "#5E5CE6", "#ff9500", "#34c759"];
  return (
    <div className="w-[235px] space-y-2.5 rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      {rows.map((color, i) => (
        <div key={color} className="flex items-center gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-full" style={{ background: `${color}1f` }}>
            <div className="m-[7px] h-3.5 w-3.5 rounded-full" style={{ background: color }} />
          </div>
          <div className="h-2 flex-1 rounded-full bg-[#E7ECF2]" />
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#34c759] animate-tut-pop" style={{ animationDelay: `${i * 0.45}s` }}>
            <CheckIcon />
          </div>
        </div>
      ))}
    </div>
  );
}

function MarksIllustration() {
  return (
    <div className="w-[235px] rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex h-24 items-end gap-2">
        {[45, 72, 58, 88, 66].map((h, i) => (
          <div
            key={i}
            className="flex-1 origin-bottom animate-tut-bar rounded-t-md bg-gradient-to-t from-[#5E5CE6] to-[#9A98F2]"
            style={{ height: `${h}%`, animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#F0F2F5] pt-3">
        <div className="space-y-1.5">
          <div className="h-2 w-16 rounded-full bg-[#E7ECF2]" />
          <div className="h-1.5 w-10 rounded-full bg-[#E7ECF2]" />
        </div>
        <span className="rounded-full bg-[#5E5CE6]/10 px-2.5 py-1 text-[13px] font-bold text-[#5E5CE6]">A+</span>
      </div>
    </div>
  );
}

function FeesIllustration() {
  return (
    <div className="w-[235px] rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-1.5 w-12 rounded-full bg-[#E7ECF2]" />
          <span className="text-[19px] font-bold tracking-tight text-[#1d1d1f]">₹12,500</span>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34c759]">
          <CheckIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ff9500] to-[#ffbe55] animate-tut-fill" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-[#0F8A4A]">Paid in full</span>
        <span className="text-[#86868b]">Receipt sent</span>
      </div>
    </div>
  );
}

function CommunicationIllustration() {
  return (
    <div className="w-[235px] space-y-2.5 rounded-2xl bg-white p-4 shadow-[0_16px_44px_-16px_rgba(15,20,25,0.35)]">
      <div className="flex items-center gap-2.5 border-b border-[#F0F2F5] pb-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]">
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-24 rounded-full bg-[#1d1d1f]/70" />
          <div className="h-1.5 w-14 rounded-full bg-[#86868b]/40" />
        </div>
      </div>
      <div className="ml-auto w-[82%] animate-tut-rise rounded-2xl rounded-tr-md bg-[#DCF8C6] px-3 py-2.5">
        <div className="h-1.5 w-full rounded-full bg-[#5b8c52]/40" />
        <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-[#5b8c52]/40" />
        <div className="mt-1.5 flex justify-end">
          <svg className="h-3.5 w-4" fill="none" viewBox="0 0 24 24" stroke="#34B7F1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 13 4 4L15 7" />
            <path d="m11 15 2 2L22 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

const STEPS: TutorialStep[] = [
  {
    key: "welcome",
    title: "Welcome to SmartShala",
    description: "Your whole school runs from one place — students, attendance, exams, fees and parent updates. Here's a 1-minute tour of the core features.",
    tip: "You can reopen this tour anytime from “Tutorial” at the bottom of the sidebar.",
    accent: "#0071e3",
    accentSoft: "#EAF3FF",
    illustration: <WelcomeIllustration />
  },
  {
    key: "attendance",
    title: "Mark attendance in seconds",
    description: "Open Attendance, pick a class, and tap each student present or absent. Parents of absentees can be notified automatically — no registers, no manual calls.",
    tip: "Daily attendance feeds straight into reports and the dashboard.",
    accent: "#34c759",
    accentSoft: "#EAF9EF",
    illustration: <AttendanceIllustration />
  },
  {
    key: "marks",
    title: "Exams & marks, graded for you",
    description: "Create an exam, enter each student's marks, and SmartShala calculates totals, percentages and grades instantly — ready to share as report cards.",
    tip: "Grades and performance trends appear automatically in Reports.",
    accent: "#5E5CE6",
    accentSoft: "#EEEEFD",
    illustration: <MarksIllustration />
  },
  {
    key: "fees",
    title: "Collect fees & track dues",
    description: "Assign fee structures, record payments, and watch pending dues update live. Every payment generates a receipt you can send to parents on WhatsApp.",
    tip: "The Fees page shows defaulters at a glance so nothing slips through.",
    accent: "#ff9500",
    accentSoft: "#FFF4E5",
    illustration: <FeesIllustration />
  },
  {
    key: "communication",
    title: "Keep parents in the loop",
    description: "Send attendance alerts, fee reminders and announcements to parents over WhatsApp — to one student or a whole class — right from the Communication hub.",
    tip: "You're all set! Explore the sidebar to dive into any feature.",
    accent: "#25D366",
    accentSoft: "#E9FBEF",
    illustration: <CommunicationIllustration />
  }
];

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => setMounted(true), []);

  // Always restart at the first step whenever the tour is opened.
  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStepIndex((index) => Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Feature tutorial">
      <button className="absolute inset-0 cursor-default" aria-label="Close tutorial" onClick={onClose} type="button" />

      <div className="relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[var(--shadow-modal)] animate-scale-in">
        {/* Illustration stage */}
        <div className="relative flex h-[224px] items-center justify-center overflow-hidden" style={{ background: `linear-gradient(160deg, ${step.accentSoft} 0%, #ffffff 100%)` }}>
          <button
            aria-label="Close tutorial"
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE1E8] bg-white/90 text-[#52687D] shadow-sm transition hover:bg-white hover:text-[#031526]"
            onClick={onClose}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div key={step.key} className="animate-scale-in">{step.illustration}</div>
        </div>

        {/* Copy */}
        <div className="px-6 pb-5 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: step.accent }}>
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{step.title}</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#5A6573]">{step.description}</p>
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: step.accentSoft }}>
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke={step.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.2 1 2.5h6c0-1.3.5-2 1-2.5A6 6 0 0 0 12 3Z" />
            </svg>
            <p className="text-[12.5px] font-medium leading-5 text-[#2A3340]">{step.tip}</p>
          </div>
        </div>

        {/* Footer: progress + nav */}
        <div className="flex items-center justify-between border-t border-[#F0F2F5] bg-[#FAFBFD] px-6 py-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((dot, index) => (
              <span
                key={dot.key}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: index === stepIndex ? 20 : 6, background: index === stepIndex ? step.accent : "#D2D8E0" }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center rounded-[8px] border border-[#C9D3DE] bg-white px-4 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isFirst}
              onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
              type="button"
            >
              Previous
            </button>
            <button
              className="inline-flex h-9 items-center rounded-[8px] px-5 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: step.accent }}
              onClick={() => (isLast ? onClose() : setStepIndex((index) => Math.min(index + 1, STEPS.length - 1)))}
              type="button"
            >
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
