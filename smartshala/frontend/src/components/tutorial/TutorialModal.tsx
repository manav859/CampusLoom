"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FEATURES, type FeatureKey } from "./tutorialContent";

type TutorialModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: (featureKey?: FeatureKey) => void;
};

export function TutorialModal({ isOpen, onClose, onStartTour }: TutorialModalProps) {
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

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Feature tutorial">
      <button className="absolute inset-0 cursor-default" aria-label="Close tutorial" onClick={onClose} type="button" />

      <div className="relative flex max-h-[calc(100dvh-3rem)] w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[var(--shadow-modal)] animate-scale-in">
        {/* Illustration stage */}
        <div className="relative flex h-[200px] shrink-0 items-center justify-center overflow-hidden" style={{ background: `linear-gradient(160deg, ${step.accentSoft} 0%, #ffffff 100%)` }}>
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
          <div key={step.key} className="origin-center scale-90 animate-scale-in">{step.illustration}</div>
        </div>

        {/* Copy + how-to */}
        <div className="min-h-0 overflow-y-auto px-6 pb-5 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: step.accent }}>
            {isWelcome ? "Getting started" : `Step ${stepIndex} of ${FEATURES.length - 1}`}
          </p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[#1d1d1f]">{step.title}</h2>
          <p className="mt-1.5 text-[14px] leading-6 text-[#5A6573]">{step.intro}</p>

          {isWelcome ? (
            <ul className="mt-3.5 space-y-2">
              {step.howto.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#2A3340]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: step.accent }}>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <ol className="mt-3.5 space-y-2.5">
              {step.howto.map((item, index) => (
                <li key={item} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: step.accent }}>
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-[13.5px] leading-5 text-[#2A3340]">{item}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: step.accentSoft }}>
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke={step.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.2 1 2.5h6c0-1.3.5-2 1-2.5A6 6 0 0 0 12 3Z" />
            </svg>
            <p className="text-[12.5px] font-medium leading-5 text-[#2A3340]">{step.tip}</p>
          </div>

          <button
            type="button"
            onClick={() => onStartTour(isWelcome ? undefined : step.key)}
            className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-[10px] border px-4 py-2.5 text-[13px] font-semibold transition-colors"
            style={{ borderColor: step.accent, color: step.accent, background: `${step.accentSoft}` }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
            {isWelcome ? "Show me in the app (live walkthrough)" : "Show me in the app"}
          </button>
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
              className="inline-flex h-9 items-center rounded-[8px] px-5 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: step.accent }}
              onClick={() => (isLast ? onClose() : setStepIndex((index) => Math.min(index + 1, FEATURES.length - 1)))}
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
