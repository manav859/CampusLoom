"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { TourStep } from "./tutorialContent";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const TOOLTIP_W = 340;

export function SpotlightTour({
  steps,
  onClose,
  navigate
}: {
  steps: TourStep[];
  onClose: () => void;
  navigate: (route: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const targetRef = useRef<Element | null>(null);

  useEffect(() => setMounted(true), []);

  const step = steps[index];

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  // Navigate to the feature page and locate the highlighted control.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    targetRef.current = null;
    setRect(null);
    navigate(step.route);

    const start = Date.now();
    const timer = window.setInterval(() => {
      if (cancelled) return;
      const el = document.querySelector(step.selector);
      if (el) {
        targetRef.current = el;
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        window.setTimeout(() => {
          if (!cancelled) measure();
        }, 350);
        window.clearInterval(timer);
      } else if (Date.now() - start > 4000) {
        window.clearInterval(timer); // graceful: tooltip stays centered
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [step, navigate, measure]);

  // Keep the spotlight aligned while the page scrolls or resizes.
  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, steps.length]);

  if (!mounted || !step) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;

  let tooltipStyle: CSSProperties;
  if (rect) {
    const below = vh - (rect.top + rect.height) > 280;
    const top = below ? rect.top + rect.height + PAD + 10 : Math.max(12, rect.top - PAD - 280);
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    left = Math.max(12, Math.min(left, vw - TOOLTIP_W - 12));
    tooltipStyle = { position: "fixed", top, left, width: TOOLTIP_W };
  } else {
    tooltipStyle = { position: "fixed", top: "50%", left: "50%", width: TOOLTIP_W, transform: "translate(-50%, -50%)" };
  }

  return createPortal(
    <div className="fixed inset-0 z-[300]">
      {/* Spotlight cutout (or full dim when the target isn't on screen yet) */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-[10px] transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(15,20,25,0.62)",
            outline: `2px solid ${step.accent}`,
            outlineOffset: "2px"
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(15,20,25,0.62)]" />
      )}

      {/* Catch clicks so the app underneath stays read-only during the tour */}
      <div className="fixed inset-0" />

      {/* Coach-mark */}
      <div className="animate-scale-in rounded-2xl bg-white p-5 shadow-[var(--shadow-modal)]" style={tooltipStyle}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: step.accent }}>
            Live walkthrough · {index + 1}/{steps.length}
          </p>
          <button aria-label="End walkthrough" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#86868b] hover:bg-[#F2F4F7]" onClick={onClose} type="button">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <h3 className="mt-1 text-[16px] font-semibold text-[#1d1d1f]">{step.title}</h3>
        {!rect ? <p className="mt-1 text-[12px] font-medium text-[#86868b]">Opening the page — follow these steps:</p> : null}
        <ol className="mt-2.5 space-y-2">
          {step.howto.map((item, i) => (
            <li key={item} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: step.accent }}>
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-5 text-[#2A3340]">{item}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center justify-between">
          <button className="text-[12px] font-semibold text-[#86868b] hover:text-[#1d1d1f]" onClick={onClose} type="button">
            Skip
          </button>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-8 items-center rounded-[8px] border border-[#C9D3DE] bg-white px-3 text-[12px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isFirst}
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              type="button"
            >
              Back
            </button>
            <button
              className="inline-flex h-8 items-center rounded-[8px] px-4 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: step.accent }}
              onClick={() => (isLast ? onClose() : setIndex((i) => Math.min(i + 1, steps.length - 1)))}
              type="button"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
