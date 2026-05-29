"use client";

export default function ExamsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff3b30]/10">
        <svg className="h-7 w-7 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </div>
      <div>
        <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Something went wrong</h2>
        <p className="mt-1 max-w-md text-[14px] text-[#86868b]">
          {error.message || "An unexpected error occurred while loading the Exams module."}
        </p>
      </div>
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-[#2456E6] px-5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,20,25,0.08)] transition hover:bg-[#1B45BD]"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
