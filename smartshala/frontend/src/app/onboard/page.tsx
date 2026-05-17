"use client";

import { motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { env } from "@/lib/env";

type PlanType = "TRIAL" | "STANDARD";

type CouponPreview = {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode: string | null;
  valid: boolean;
  message: string;
};

const initialPreview: CouponPreview = {
  baseAmount: 20000,
  discountAmount: 0,
  finalAmount: 20000,
  couponCode: null,
  valid: true,
  message: "No coupon applied"
};

export default function OnboardPage() {
  const router = useRouter();
  const [planType, setPlanType] = useState<PlanType>("TRIAL");
  const [couponCode, setCouponCode] = useState("");
  const [preview, setPreview] = useState<CouponPreview>(initialPreview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    schoolName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    numberOfStudents: "300",
    numberOfStaff: "35",
    termsAccepted: false
  });

  const finalAmount = planType === "TRIAL" ? 0 : preview.finalAmount;

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!couponCode.trim()) {
        setPreview(initialPreview);
        return;
      }

      const response = await fetch(`${env.apiBaseUrl}/onboarding/coupon-preview?code=${encodeURIComponent(couponCode.trim())}`);
      if (response.ok) setPreview(await response.json());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [couponCode]);

  const priceLine = useMemo(() => {
    if (planType === "TRIAL") return "30 days free";
    return `Rs. ${finalAmount.toLocaleString("en-IN")}`;
  }, [finalAmount, planType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${env.apiBaseUrl}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          numberOfStudents: Number(form.numberOfStudents),
          numberOfStaff: Number(form.numberOfStaff),
          planType,
          couponCode: couponCode.trim() || undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Onboarding failed");
      router.replace(`/onboarding-success?schoolId=${payload.schoolId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(145deg,#f5f5f7_0%,#ffffff_46%,#eef6ff_100%)] px-5 py-8 text-[#1d1d1f]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="space-y-7"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-[#34c759]" />
            SmartShala SaaS onboarding
          </div>
          <div>
            <h1 className="max-w-xl text-5xl font-semibold tracking-normal text-[#1d1d1f] md:text-6xl">
              Launch a school workspace in minutes.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-[#6e6e73]">
              Isolated database, clean tenant routing, and a ready principal account for every school.
            </p>
          </div>
          <div className="grid max-w-lg grid-cols-3 gap-3">
            {["Private DB", "30 day trial", "No subdomains"].map((item) => (
              <div className="rounded-2xl border border-white/70 bg-white/55 p-4 text-sm font-semibold shadow-sm backdrop-blur-xl" key={item}>
                {item}
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_32px_100px_rgba(15,23,42,0.14)] backdrop-blur-2xl sm:p-7"
          initial={{ opacity: 0, y: 24 }}
          transition={{ delay: 0.08, duration: 0.55 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#86868b]">New school</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">Create workspace</h2>
            </div>
            <div className="rounded-2xl bg-[#1d1d1f] px-4 py-3 text-right text-white">
              <p className="text-xs text-white/60">Today</p>
              <p className="text-lg font-semibold">{priceLine}</p>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="School Name" onChange={(value) => setForm({ ...form, schoolName: value })} value={form.schoolName} />
              <Input label="Principal/Owner Name" onChange={(value) => setForm({ ...form, ownerName: value })} value={form.ownerName} />
              <Input label="Email" onChange={(value) => setForm({ ...form, email: value })} type="email" value={form.email} />
              <Input label="Phone" onChange={(value) => setForm({ ...form, phone: value })} value={form.phone} />
              <Input label="Number of Students" onChange={(value) => setForm({ ...form, numberOfStudents: value })} type="number" value={form.numberOfStudents} />
              <Input label="Number of Staff" onChange={(value) => setForm({ ...form, numberOfStaff: value })} type="number" value={form.numberOfStaff} />
            </div>

            <label className="grid gap-2 text-sm font-semibold text-[#424245]">
              Address
              <textarea
                className="min-h-24 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-[15px] font-medium outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                required
                value={form.address}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <PlanButton active={planType === "TRIAL"} label="Start 1 Month Free Trial" onClick={() => setPlanType("TRIAL")} />
              <PlanButton active={planType === "STANDARD"} label="Purchase Now Rs. 20,000" onClick={() => setPlanType("STANDARD")} />
            </div>

            <Input label="Coupon Code" onChange={setCouponCode} required={false} value={couponCode} />
            {couponCode ? (
              <p className={`text-sm font-semibold ${preview.valid ? "text-[#0f8a4a]" : "text-[#c8242c]"}`}>
                {preview.message}
              </p>
            ) : null}

            <label className="flex items-start gap-3 text-sm font-semibold text-[#424245]">
              <input
                checked={form.termsAccepted}
                className="mt-1 h-4 w-4 accent-[#0071e3]"
                onChange={(event) => setForm({ ...form, termsAccepted: event.target.checked })}
                required
                type="checkbox"
              />
              I agree to activate this school workspace and receive login credentials.
            </label>

            {error ? <p className="rounded-2xl bg-[#fce3e5] px-4 py-3 text-sm font-semibold text-[#c8242c]">{error}</p> : null}

            <button
              className="min-h-12 rounded-full bg-[#0071e3] px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[#b8c7d9]"
              disabled={loading}
              type="submit"
            >
              {loading ? "Creating workspace..." : planType === "TRIAL" ? "Start 1 Month Free Trial" : "Purchase Now Rs. 20,000"}
            </button>
          </form>
        </motion.section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#424245]">
      {label}
      <input
        className="min-h-12 rounded-2xl border border-black/10 bg-white/80 px-4 text-[15px] font-medium outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function PlanButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-bold transition ${
        active ? "border-[#0071e3] bg-[#e7f1ff] text-[#0057b8]" : "border-black/10 bg-white/70 text-[#424245] hover:bg-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
