"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FEATURES, WELCOME_CHECKLIST, WelcomeIllustration, type FeatureKey } from "./tutorialContent";
import { AttendanceMock, MarksMock, FeesMock, CommsMock } from "./TutorialMocks";

type TutorialModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<Set<FeatureKey>>(new Set());

  useEffect(() => setMounted(true), []);

  // Restart the demo whenever it is opened.
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setDone(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStepIndex((index) => Math.min(index + 1, FEATURES.length - 1));
      if (event.key === "ArrowLeft") setStepIndex((index) => Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const step = FEATURES[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === FEATURES.length - 1;
  const isWelcome = step.key === "welcome";
  const markDone = () => setDone((prev) => new Set(prev).add(step.key));
  const stepDone = isWelcome || done.has(step.key);

  const stage: Record<FeatureKey, ReactNode> = {
    welcome: <WelcomeIllustration />,
    attendance: <AttendanceMock accent={step.accent} onComplete={markDone} />,
    marks: <MarksMock accent={step.accent} onComplete={markDone} />,
    fees: <FeesMock accent={step.accent} onComplete={markDone} />,
    communication: <CommsMock accent={step.accent} onComplete={markDone} />
  };

  const nextLabel = isLast ? "Finish" : isWelcome ? "Start" : "Next";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Interactive tutorial">
      <button className="absolute inset-0 cursor-default" aria-label="Close tutorial" onClick={onClose} type="button" />

      <div className="relative flex max-h-[calc(100dvh-3rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[var(--shadow-modal)] animate-scale-in">
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Interactive stage */}
          <div className="flex items-center justify-center px-5 py-7" style={{ background: `linear-gradient(160deg, ${step.accentSoft} 0%, #ffffff 100%)` }}>
            <div key={step.key} className="animate-scale-in">{stage[step.key]}</div>
          </div>

          {/* Copy */}
          <div className="px-6 pb-5 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: step.accent }}>
              {isWelcome ? "Getting started" : `Step ${stepIndex} of ${FEATURES.length - 1}`}
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{step.title}</h2>
            <p className="mt-1.5 text-[14px] leading-6 text-[#5A6573]">{step.subtitle}</p>

            {isWelcome ? (
              <ul className="mt-3.5 space-y-2">
                {WELCOME_CHECKLIST.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#2A3340]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: step.accent }}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {/* Footer: progress + nav */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#F0F2F5] bg-[#FAFBFD] px-6 py-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {FEATURES.map((dot, index) => (
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
              className={`inline-flex h-9 items-center gap-1.5 rounded-[8px] px-5 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 ${stepDone && !isLast ? "ring-2 ring-offset-2" : ""}`}
              style={{ background: step.accent, ...(stepDone && !isLast ? ({ "--tw-ring-color": step.accent } as React.CSSProperties) : {}) }}
              onClick={() => (isLast ? onClose() : setStepIndex((index) => Math.min(index + 1, FEATURES.length - 1)))}
              type="button"
            >
              {stepDone && !isWelcome && !isLast ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
              ) : null}
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
