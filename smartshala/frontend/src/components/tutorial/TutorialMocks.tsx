"use client";

import { useState } from "react";

type MockProps = { accent: string; onComplete?: () => void };

function Avatar({ name, accent }: { name: string; accent: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: `${accent}1f`, color: accent }}>
      {initials}
    </div>
  );
}

function SuccessBar({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold animate-scale-in" style={{ background: `${accent}14`, color: accent }}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: accent }}>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
      </span>
      {children}
    </div>
  );
}

const cardClass = "w-[300px] rounded-2xl bg-white p-3.5 shadow-[0_16px_44px_-18px_rgba(15,20,25,0.4)]";

/* ── Attendance ── */
export function AttendanceMock({ accent, onComplete }: MockProps) {
  const roster = ["Aarav Sharma", "Diya Patel", "Kabir Singh", "Riya Shah"];
  const [status, setStatus] = useState<("present" | "absent")[]>(["present", "present", "present", "present"]);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const absent = status.filter((s) => s === "absent").length;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between pb-2.5">
        <span className="text-[13px] font-semibold text-[#1d1d1f]">Class 5 · A</span>
        <span className="text-[11px] font-medium text-[#86868b]">Today</span>
      </div>
      <div className="space-y-1.5">
        {roster.map((name, i) => {
          const present = status[i] === "present";
          return (
            <div key={name} className="flex items-center gap-2.5">
              <Avatar name={name} accent={accent} />
              <span className="flex-1 truncate text-[13px] font-medium text-[#2A3340]">{name}</span>
              <button
                type="button"
                disabled={saved}
                onClick={() => {
                  setTouched(true);
                  setStatus((prev) => prev.map((s, idx) => (idx === i ? (s === "present" ? "absent" : "present") : s)));
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-100 ${
                  present ? "bg-[#34c759]/12 text-[#0F8A4A]" : "bg-[#ff3b30]/10 text-[#d70015]"
                } ${!touched && i === 0 && !saved ? "ring-2 ring-offset-1 animate-pulse" : ""}`}
                style={!touched && i === 0 && !saved ? ({ "--tw-ring-color": accent } as React.CSSProperties) : undefined}
              >
                {present ? "Present" : "Absent"}
              </button>
            </div>
          );
        })}
      </div>
      {saved ? (
        <SuccessBar accent={accent}>Attendance saved{absent > 0 ? ` · ${absent} parent${absent > 1 ? "s" : ""} notified` : ""}</SuccessBar>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSaved(true);
            onComplete?.();
          }}
          className="mt-3 w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: accent }}
        >
          Save attendance
        </button>
      )}
    </div>
  );
}

/* ── Marks ── */
export function MarksMock({ accent, onComplete }: MockProps) {
  const roster = ["Aarav Sharma", "Diya Patel", "Riya Shah"];
  const [marks, setMarks] = useState<string[]>(["86", "91", ""]);
  const [saved, setSaved] = useState(false);

  const grade = (m: number) => (m >= 90 ? "A+" : m >= 80 ? "A" : m >= 70 ? "B" : m >= 60 ? "C" : "D");
  const numbers = marks.map((m) => Number(m));
  const allValid = marks.every((m) => m.trim() !== "" && Number(m) >= 0 && Number(m) <= 100);
  const average = allValid ? Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length) : 0;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between pb-2.5">
        <span className="text-[13px] font-semibold text-[#1d1d1f]">Maths · Unit Test</span>
        <span className="text-[11px] font-medium text-[#86868b]">Max 100</span>
      </div>
      <div className="space-y-1.5">
        {roster.map((name, i) => {
          const empty = marks[i].trim() === "";
          return (
            <div key={name} className="flex items-center gap-2.5">
              <Avatar name={name} accent={accent} />
              <span className="flex-1 truncate text-[13px] font-medium text-[#2A3340]">{name}</span>
              {saved ? (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#2A3340]">
                  {marks[i]}
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${accent}14`, color: accent }}>
                    {grade(Number(marks[i]))}
                  </span>
                </span>
              ) : (
                <input
                  inputMode="numeric"
                  value={marks[i]}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                    setMarks((prev) => prev.map((m, idx) => (idx === i ? v : m)));
                  }}
                  className={`h-8 w-14 rounded-lg border bg-white text-center text-[13px] font-semibold text-[#1d1d1f] outline-none transition ${
                    empty ? "border-transparent ring-2 animate-pulse" : "border-[#DCE1E8]"
                  }`}
                  style={empty ? ({ "--tw-ring-color": accent } as React.CSSProperties) : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
      {saved ? (
        <SuccessBar accent={accent}>Saved · class average {average}% — grades auto-calculated</SuccessBar>
      ) : (
        <button
          type="button"
          disabled={!allValid}
          onClick={() => {
            setSaved(true);
            onComplete?.();
          }}
          className="mt-3 w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: accent }}
        >
          Save marks
        </button>
      )}
    </div>
  );
}

/* ── Fees ── */
export function FeesMock({ accent, onComplete }: MockProps) {
  const [phase, setPhase] = useState<"idle" | "form" | "paid">("idle");
  const [mode, setMode] = useState("UPI");

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2.5 pb-3">
        <Avatar name="Aarav Sharma" accent={accent} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">Aarav Sharma</p>
          <p className="text-[11px] font-medium text-[#86868b]">{phase === "paid" ? "Dues cleared" : "Pending ₹12,500"}</p>
        </div>
      </div>

      {phase === "idle" ? (
        <button
          type="button"
          onClick={() => setPhase("form")}
          className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: accent }}
        >
          Record payment
        </button>
      ) : phase === "form" ? (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-[#E7ECF2] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">Amount</p>
            <p className="text-[16px] font-bold text-[#1d1d1f]">₹12,500</p>
          </div>
          <div className="flex gap-1.5">
            {["Cash", "UPI", "Cheque"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg border py-1.5 text-[12px] font-semibold transition-colors ${mode === m ? "text-white" : "border-[#DCE1E8] bg-white text-[#2A3340]"}`}
                style={mode === m ? { background: accent, borderColor: accent } : undefined}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setPhase("paid");
              onComplete?.();
            }}
            className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            Confirm payment
          </button>
        </div>
      ) : (
        <div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: "100%", background: accent }} />
          </div>
          <SuccessBar accent={accent}>Paid in full · Receipt #1024 ready to share on WhatsApp</SuccessBar>
        </div>
      )}
    </div>
  );
}

/* ── Communication ── */
export function CommsMock({ accent, onComplete }: MockProps) {
  const templates = [
    { id: "holiday", label: "Holiday notice", text: "School will remain closed tomorrow for a public holiday. Classes resume the next day." },
    { id: "fee", label: "Fee reminder", text: "Gentle reminder: the term fee is due this Friday. Please clear pending dues at your earliest." },
    { id: "ptm", label: "PTM invite", text: "You're invited to the Parent–Teacher Meeting this Saturday at 10 AM. We look forward to seeing you." }
  ];
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<"compose" | "sending" | "sent">("compose");
  const text = templates.find((t) => t.id === selected)?.text;

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2.5 border-b border-[#F0F2F5] pb-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]">
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z" />
          </svg>
        </div>
        <span className="text-[12px] font-semibold text-[#1d1d1f]">To: Class 5 · A parents</span>
      </div>

      {phase === "sent" ? (
        <div className="pt-3">
          <div className="ml-auto w-[86%] rounded-2xl rounded-tr-md bg-[#DCF8C6] px-3 py-2.5 animate-scale-in">
            <p className="text-[11.5px] leading-4 text-[#274d1a]">{text}</p>
            <div className="mt-1 flex justify-end">
              <svg className="h-3.5 w-4" fill="none" viewBox="0 0 24 24" stroke="#34B7F1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m2 13 4 4L15 7" /><path d="m11 15 2 2L22 7" /></svg>
            </div>
          </div>
          <SuccessBar accent={accent}>Delivered to 32 parents on WhatsApp</SuccessBar>
        </div>
      ) : (
        <div className="pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${selected === t.id ? "text-white" : "border-[#DCE1E8] bg-white text-[#2A3340]"}`}
                style={selected === t.id ? { background: accent, borderColor: accent } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 min-h-[58px] rounded-xl bg-[#F7F8FB] px-3 py-2 text-[11.5px] leading-4 text-[#2A3340]">
            {text ?? <span className="text-[#86868b]">Pick a template to preview the message…</span>}
          </div>
          <button
            type="button"
            disabled={!selected || phase === "sending"}
            onClick={() => {
              setPhase("sending");
              window.setTimeout(() => {
                setPhase("sent");
                onComplete?.();
              }, 850);
            }}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: accent }}
          >
            {phase === "sending" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
            {phase === "sending" ? "Sending…" : "Send on WhatsApp"}
          </button>
        </div>
      )}
    </div>
  );
}
