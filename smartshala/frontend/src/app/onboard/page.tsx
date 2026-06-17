"use client";

import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { env } from "@/lib/env";

type PlanType = "TRIAL" | "STANDARD";

export default function OnboardPage() {
  const router = useRouter();
  const planType: PlanType = "TRIAL";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    schoolName: "",
    ownerName: "",
    email: "",
    phone: "",
    adminPassword: "",
    confirmPassword: "",
    address: "",
    numberOfStudents: "",
    numberOfStaff: "",
    termsAccepted: false
  });

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const schoolName = form.schoolName.trim();
    if (!schoolName) {
      newErrors.schoolName = "School name is required";
    } else if (schoolName.length < 2) {
      newErrors.schoolName = "School name must be at least 2 characters";
    } else if (schoolName.length > 160) {
      newErrors.schoolName = "School name cannot exceed 160 characters";
    }

    const ownerName = form.ownerName.trim();
    if (!ownerName) {
      newErrors.ownerName = "Principal/Owner name is required";
    } else if (ownerName.length < 2) {
      newErrors.ownerName = "Principal/Owner name must be at least 2 characters";
    } else if (ownerName.length > 120) {
      newErrors.ownerName = "Principal/Owner name cannot exceed 120 characters";
    }

    const email = form.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = "Email address is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    const phone = form.phone.trim();
    if (!phone) {
      newErrors.phone = "Phone number is required";
    } else if (phone.length < 10) {
      newErrors.phone = "Phone number must be at least 10 characters";
    } else if (phone.length > 20) {
      newErrors.phone = "Phone number cannot exceed 20 characters";
    }

    if (!form.adminPassword) {
      newErrors.adminPassword = "Password is required";
    } else if (form.adminPassword.length < 8) {
      newErrors.adminPassword = "Password must be at least 8 characters";
    } else if (form.adminPassword.length > 72) {
      newErrors.adminPassword = "Password cannot exceed 72 characters";
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (form.adminPassword !== form.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    const studentsVal = Number(form.numberOfStudents);
    if (!form.numberOfStudents) {
      newErrors.numberOfStudents = "Number of students is required";
    } else if (isNaN(studentsVal) || !Number.isInteger(studentsVal)) {
      newErrors.numberOfStudents = "Must be a valid integer";
    } else if (studentsVal < 1 || studentsVal > 10000) {
      newErrors.numberOfStudents = "Must be between 1 and 10,000";
    }

    const staffVal = Number(form.numberOfStaff);
    if (!form.numberOfStaff) {
      newErrors.numberOfStaff = "Number of staff is required";
    } else if (isNaN(staffVal) || !Number.isInteger(staffVal)) {
      newErrors.numberOfStaff = "Must be a valid integer";
    } else if (staffVal < 1 || staffVal > 1000) {
      newErrors.numberOfStaff = "Must be between 1 and 1,000";
    }

    const address = form.address.trim();
    if (!address) {
      newErrors.address = "Address is required";
    } else if (address.length < 5) {
      newErrors.address = "Address must be at least 5 characters";
    } else if (address.length > 500) {
      newErrors.address = "Address cannot exceed 500 characters";
    }

    if (!form.termsAccepted) {
      newErrors.termsAccepted = "You must agree to the terms to proceed";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${env.apiBaseUrl}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: form.schoolName,
          ownerName: form.ownerName,
          email: form.email,
          phone: form.phone,
          adminPassword: form.adminPassword,
          address: form.address,
          numberOfStudents: Number(form.numberOfStudents),
          numberOfStaff: Number(form.numberOfStaff),
          planType,
          termsAccepted: form.termsAccepted
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        // Extract field-level validation errors if available
        const details = payload?.error?.details;
        if (details?.fieldErrors && typeof details.fieldErrors === "object") {
          const mappedErrors: Record<string, string> = {};
          let hasMapped = false;
          Object.entries(details.fieldErrors).forEach(([field, msgs]) => {
            if (Array.isArray(msgs) && msgs.length > 0) {
              mappedErrors[field] = msgs[0];
              hasMapped = true;
            }
          });
          if (hasMapped) {
            setErrors(mappedErrors);
            throw new Error("Please correct the highlighted errors.");
          }
        }
        throw new Error(
          payload?.error?.message ??
            `Onboarding failed (${response.status} ${response.statusText})`
        );
      }
      if (!payload?.schoolId) {
        throw new Error("Unexpected response from server. Please try again.");
      }
      router.replace(`/onboarding-success?schoolId=${payload.schoolId}`);
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Network error — please check your internet connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Onboarding failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1733] text-[#1d1d1f]">
      {/* Brand atmosphere */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#2456E6]/30 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[#34c759]/20 blur-[130px]" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-[#2456E6]/10 blur-[120px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1240px] items-stretch gap-0 px-5 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:px-8">
        {/* ── Brand / value column ───────────────────────────── */}
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col justify-between py-6 text-white lg:py-10"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <Link href="/login" className="inline-flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2456E6] to-[#34c759] shadow-lg shadow-[#2456E6]/30">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <path d="M4 7.5L12 4l8 3.5L12 11 4 7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M6 9.5v7L12 20l6-3.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-white">SmartShala</span>
            </Link>

            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white/90 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
              Enterprise school onboarding
            </div>

            <h1 className="mt-6 max-w-xl text-[40px] font-semibold leading-[1.05] tracking-tight text-white md:text-[52px]">
              Run your entire campus on one platform.
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-7 text-white/70">
              Provision a fully isolated workspace for your school — dedicated database,
              secure tenant routing, and a ready-to-use principal account. Live in minutes,
              no infrastructure to manage.
            </p>

            <ul className="mt-9 space-y-4">
              {[
                {
                  title: "Dedicated, isolated database",
                  body: "Your students, staff, and records never share storage with another school."
                },
                {
                  title: "Principal account, provisioned instantly",
                  body: "Secure admin credentials are created the moment your workspace goes live."
                },
                {
                  title: "Attendance, fees & analytics built in",
                  body: "Parents stay updated on WhatsApp while your team works from one dashboard."
                }
              ].map((item) => (
                <li className="flex gap-3.5" key={item.title}>
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#34c759]/20 text-[#34c759]">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-white">{item.title}</p>
                    <p className="mt-0.5 text-[13.5px] leading-6 text-white/60">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-white/55">
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24">
                <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Bank-grade security
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
              30-day free trial
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
              No credit card required
            </span>
          </div>
        </motion.section>

        {/* ── Form column ────────────────────────────────────── */}
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center py-6 lg:py-10"
          initial={{ opacity: 0, y: 24 }}
          transition={{ delay: 0.08, duration: 0.55 }}
        >
          <div className="w-full rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_40px_120px_-40px_rgba(8,18,48,0.7)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.06] pb-5">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#2456E6]">
                  Create your workspace
                </p>
                <h2 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
                  Tell us about your school
                </h2>
                <p className="mt-1 text-[13.5px] text-[#6e6e73]">
                  Takes about 2 minutes. You can refine details later.
                </p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-[#2456E6] to-[#1B45BD] px-4 py-2.5 text-right text-white shadow-lg shadow-[#2456E6]/25">
                <p className="text-[11px] font-medium text-white/70">Your plan</p>
                <p className="text-[15px] font-semibold">30 days free</p>
              </div>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={submit} noValidate>
              <Fieldset label="School details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="School name"
                    placeholder="Noble Public School"
                    onChange={(value) => updateField("schoolName", value)}
                    value={form.schoolName}
                    error={errors.schoolName}
                  />
                  <Input
                    label="Principal / Owner name"
                    placeholder="Full name"
                    onChange={(value) => updateField("ownerName", value)}
                    value={form.ownerName}
                    error={errors.ownerName}
                  />
                  <Input
                    label="Number of students"
                    placeholder="e.g. 300"
                    onChange={(value) => updateField("numberOfStudents", value)}
                    type="number"
                    value={form.numberOfStudents}
                    error={errors.numberOfStudents}
                  />
                  <Input
                    label="Number of staff"
                    placeholder="e.g. 35"
                    onChange={(value) => updateField("numberOfStaff", value)}
                    type="number"
                    value={form.numberOfStaff}
                    error={errors.numberOfStaff}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-[13px] font-semibold text-[#424245]">School address</label>
                  <textarea
                    className={`min-h-[88px] rounded-2xl border bg-white px-4 py-3 text-[15px] font-medium text-[#1d1d1f] outline-none transition placeholder:text-[#aeb2bb] focus:ring-4 ${
                      errors.address
                        ? "border-[#c8242c] focus:border-[#c8242c] focus:ring-[#c8242c]/10"
                        : "border-black/10 focus:border-[#2456E6] focus:ring-[#2456E6]/10"
                    }`}
                    placeholder="Street, city, state and PIN code"
                    onChange={(event) => updateField("address", event.target.value)}
                    value={form.address}
                  />
                  {errors.address && <FieldError>{errors.address}</FieldError>}
                </div>
              </Fieldset>

              <Fieldset label="Administrator account">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Work email"
                    placeholder="principal@school.edu"
                    onChange={(value) => updateField("email", value)}
                    type="email"
                    value={form.email}
                    error={errors.email}
                  />
                  <Input
                    label="Phone number"
                    placeholder="+91 98765 43210"
                    onChange={(value) => updateField("phone", value)}
                    value={form.phone}
                    error={errors.phone}
                  />
                  <Input
                    label="Create password"
                    placeholder="At least 8 characters"
                    onChange={(value) => updateField("adminPassword", value)}
                    type="password"
                    value={form.adminPassword}
                    error={errors.adminPassword}
                  />
                  <Input
                    label="Confirm password"
                    placeholder="Re-enter password"
                    onChange={(value) => updateField("confirmPassword", value)}
                    type="password"
                    value={form.confirmPassword}
                    error={errors.confirmPassword}
                  />
                </div>
              </Fieldset>

              <div className="flex items-center gap-3 rounded-2xl border border-[#2456E6]/20 bg-[#2456E6]/[0.06] px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2456E6] shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-[#1B45BD]">30-day free trial included</p>
                  <p className="text-[12.5px] text-[#5566a0]">Full access from day one. No card needed to start.</p>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-6 font-medium text-[#424245]">
                  <input
                    checked={form.termsAccepted}
                    className="mt-0.5 h-4 w-4 accent-[#2456E6]"
                    onChange={(event) => updateField("termsAccepted", event.target.checked)}
                    type="checkbox"
                  />
                  I agree to activate this school workspace and receive secure login credentials by email.
                </label>
                {errors.termsAccepted && <FieldError>{errors.termsAccepted}</FieldError>}
              </div>

              {error ? (
                <div className="whitespace-pre-line rounded-2xl border border-[#c8242c]/20 bg-[#fce3e5] px-4 py-3 text-[13.5px] font-semibold text-[#c8242c]">
                  {error}
                </div>
              ) : null}

              <button
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#2456E6] px-6 text-[15px] font-semibold text-white shadow-lg shadow-[#2456E6]/25 transition hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:bg-[#b8c1d9] disabled:shadow-none"
                disabled={loading}
                type="submit"
              >
                {loading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating your workspace…
                  </>
                ) : (
                  "Create workspace & start free trial"
                )}
              </button>

              <p className="text-center text-[12.5px] text-[#86868b]">
                Already have a workspace?{" "}
                <Link className="font-semibold text-[#2456E6] hover:text-[#1B45BD]" href="/login">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function Fieldset({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      animate={{ opacity: 1, y: 0 }}
      className="px-1 text-[12px] font-semibold text-[#c8242c]"
      initial={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.p>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  error,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-[13px] font-semibold text-[#424245]">{label}</label>
      <input
        className={`min-h-[50px] rounded-2xl border bg-white px-4 text-[15px] font-medium text-[#1d1d1f] outline-none transition placeholder:text-[#aeb2bb] focus:ring-4 ${
          error
            ? "border-[#c8242c] focus:border-[#c8242c] focus:ring-[#c8242c]/10"
            : "border-black/10 focus:border-[#2456E6] focus:ring-[#2456E6]/10"
        }`}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
