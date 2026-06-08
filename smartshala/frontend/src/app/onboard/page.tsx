"use client";

import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
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
    numberOfStudents: "300",
    numberOfStaff: "35",
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
              <p className="text-lg font-semibold">30 days free</p>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="School Name"
                onChange={(value) => updateField("schoolName", value)}
                value={form.schoolName}
                error={errors.schoolName}
              />
              <Input
                label="Principal/Owner Name"
                onChange={(value) => updateField("ownerName", value)}
                value={form.ownerName}
                error={errors.ownerName}
              />
              <Input
                label="Email"
                onChange={(value) => updateField("email", value)}
                type="email"
                value={form.email}
                error={errors.email}
              />
              <Input
                label="Phone"
                onChange={(value) => updateField("phone", value)}
                value={form.phone}
                error={errors.phone}
              />
              <Input
                label="Initial Password"
                onChange={(value) => updateField("adminPassword", value)}
                type="password"
                value={form.adminPassword}
                error={errors.adminPassword}
              />
              <Input
                label="Confirm Password"
                onChange={(value) => updateField("confirmPassword", value)}
                type="password"
                value={form.confirmPassword}
                error={errors.confirmPassword}
              />
              <Input
                label="Number of Students"
                onChange={(value) => updateField("numberOfStudents", value)}
                type="number"
                value={form.numberOfStudents}
                error={errors.numberOfStudents}
              />
              <Input
                label="Number of Staff"
                onChange={(value) => updateField("numberOfStaff", value)}
                type="number"
                value={form.numberOfStaff}
                error={errors.numberOfStaff}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#424245]">
                Address
              </label>
              <textarea
                className={`min-h-24 rounded-2xl border bg-white/80 px-4 py-3 text-[15px] font-medium outline-none transition focus:ring-4 ${
                  errors.address
                    ? "border-[#c8242c] focus:border-[#c8242c] focus:ring-[#c8242c]/10"
                    : "border-black/10 focus:border-[#0071e3] focus:ring-[#0071e3]/10"
                }`}
                onChange={(event) => updateField("address", event.target.value)}
                value={form.address}
              />
              {errors.address && (
                <motion.p
                  animate={{ opacity: 1, y: 0 }}
                  className="px-1 text-xs font-semibold text-[#c8242c]"
                  initial={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {errors.address}
                </motion.p>
              )}
            </div>

            <div className="rounded-2xl border border-[#0071e3] bg-[#e7f1ff] px-4 py-3 text-sm font-bold text-[#0057b8]">
              Start 1 Month Free Trial
            </div>

            <div className="grid gap-2">
              <label className="flex items-start gap-3 text-sm font-semibold text-[#424245] cursor-pointer">
                <input
                  checked={form.termsAccepted}
                  className="mt-1 h-4 w-4 accent-[#0071e3]"
                  onChange={(event) => updateField("termsAccepted", event.target.checked)}
                  type="checkbox"
                />
                I agree to activate this school workspace and receive login credentials.
              </label>
              {errors.termsAccepted && (
                <motion.p
                  animate={{ opacity: 1, y: 0 }}
                  className="px-1 text-xs font-semibold text-[#c8242c]"
                  initial={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {errors.termsAccepted}
                </motion.p>
              )}
            </div>

            {error ? <div className="whitespace-pre-line rounded-2xl bg-[#fce3e5] px-4 py-3 text-sm font-semibold text-[#c8242c]">{error}</div> : null}

            <button
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0071e3] px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[#b8c7d9]"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating workspace...
                </>
              ) : (
                "Start 1 Month Free Trial"
              )}
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
  error
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-[#424245]">
        {label}
      </label>
      <input
        className={`min-h-12 rounded-2xl border bg-white/80 px-4 text-[15px] font-medium outline-none transition focus:ring-4 ${
          error
            ? "border-[#c8242c] focus:border-[#c8242c] focus:ring-[#c8242c]/10"
            : "border-black/10 focus:border-[#0071e3] focus:ring-[#0071e3]/10"
        }`}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error && (
        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="px-1 text-xs font-semibold text-[#c8242c]"
          initial={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
