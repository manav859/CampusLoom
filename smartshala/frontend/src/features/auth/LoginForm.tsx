"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Modal, TextInput, Toast } from "@/components/ui";
import { authApi } from "@/lib/api";
import { clearCache } from "@/lib/prefetchCache";

export type LoginLanguage = "en" | "hi";

type LoginFormProps = {
  language: LoginLanguage;
  onLanguageChange: (language: LoginLanguage) => void;
};

export function LoginForm({ language, onLanguageChange }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const copy = {
    en: {
      languageLabel: "Language",
      identifier: "Email or phone",
      password: "Password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      forgot: "Forgot password?",
      support: "Trouble signing in? Call +91-98765-43210",
      submit: "Sign in",
      loading: "Signing in...",
      resetTitle: "Reset password",
      resetIntro: "Enter your registered email or phone. We will record the request and support will verify it before any password change.",
      resetIdentifier: "Registered email or phone",
      resetSubmit: "Request reset",
      resetLoading: "Sending request...",
      resetCancel: "Cancel",
      resetDone: "Reset request recorded. Support will contact the school administrator.",
      close: "Close"
    },
    hi: {
      languageLabel: "भाषा",
      identifier: "ईमेल या फोन",
      password: "पासवर्ड",
      showPassword: "पासवर्ड दिखाएं",
      hidePassword: "पासवर्ड छिपाएं",
      forgot: "पासवर्ड भूल गए?",
      support: "साइन इन में परेशानी? +91-98765-43210 पर कॉल करें",
      submit: "साइन इन करें",
      loading: "साइन इन हो रहा है...",
      resetTitle: "पासवर्ड रीसेट",
      resetIntro: "अपना पंजीकृत ईमेल या फोन दर्ज करें। अनुरोध रिकॉर्ड होगा और पासवर्ड बदलने से पहले सपोर्ट सत्यापन करेगा।",
      resetIdentifier: "पंजीकृत ईमेल या फोन",
      resetSubmit: "रीसेट अनुरोध भेजें",
      resetLoading: "अनुरोध भेजा जा रहा है...",
      resetCancel: "रद्द करें",
      resetDone: "रीसेट अनुरोध रिकॉर्ड हो गया। सपोर्ट स्कूल एडमिन से संपर्क करेगा।",
      close: "बंद करें"
    }
  }[language];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      clearCache();
      const result = await authApi.login(identifier, password);
      window.localStorage.setItem("smartshala.accessToken", result.accessToken);
      window.localStorage.setItem("smartshala.refreshToken", result.refreshToken);
      window.localStorage.setItem("smartshala.user", JSON.stringify(result.user));
      const target =
        result.user.role === "TEACHER"
          ? "/teacher"
          : result.user.role === "ACCOUNTANT"
            ? "/fees"
            : result.user.role === "PARENT"
              ? "/students"
              : "/dashboard";
      router.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetLoading(true);
    setResetError("");
    setResetMessage("");
    try {
      await authApi.forgotPassword(resetIdentifier || identifier);
      setResetMessage(copy.resetDone);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Password reset request failed");
    } finally {
      setResetLoading(false);
    }
  }

  function openResetDialog() {
    setResetIdentifier(identifier);
    setResetError("");
    setResetMessage("");
    setResetOpen(true);
  }

  return (
    <>
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-[#DCE1E8] bg-white p-1 text-[12px] font-semibold">
          {(["en", "hi"] as const).map((option) => (
            <button
              aria-label={`${copy.languageLabel}: ${option === "en" ? "English" : "Hindi"}`}
              className={`rounded-md px-3 py-1.5 ${language === option ? "bg-[#2456E6] text-white" : "text-[#5A6573]"}`}
              key={option}
              onClick={() => onLanguageChange(option)}
              type="button"
            >
              {option === "en" ? "English" : "Hindi"}
            </button>
          ))}
        </div>
      </div>

      <Field label={copy.identifier}>
        <TextInput
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
      </Field>

      <Field label={copy.password}>
        <div className="relative mt-2">
          <TextInput
            className="pr-12"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5A6573] hover:bg-[#F7F8FB] hover:text-[#2456E6] focus:outline-none focus:ring-2 focus:ring-[#2456E6]/40"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.6 10.6a2 2 0 002.8 2.8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A9.8 9.8 0 0112 5c5 0 8.5 4 9.5 7a10.6 10.6 0 01-2.3 3.8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.6 6.6C4.6 7.8 3.2 9.8 2.5 12c1 3 4.5 7 9.5 7 1.4 0 2.7-.3 3.9-.9" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12c1-3 4.5-7 9.5-7s8.5 4 9.5 7c-1 3-4.5 7-9.5 7s-8.5-4-9.5-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] font-semibold">
        <button className="text-[#2456E6] hover:text-[#1B45BD]" onClick={openResetDialog} type="button">
          {copy.forgot}
        </button>
        <span className="text-[#5A6573]">{copy.support}</span>
      </div>

      {error ? <Toast message={error} tone="danger" /> : null}
      <Button
        className="w-full"
        isLoading={loading}
        size="lg"
        type="submit"
      >
        {loading ? copy.loading : copy.submit}
      </Button>

    </form>

      <Modal
        description={copy.resetIntro}
        footer={
          <>
            <Button onClick={() => setResetOpen(false)} variant="secondary">
              {resetMessage ? copy.close : copy.resetCancel}
            </Button>
            {!resetMessage ? (
              <Button form="password-reset-form" isLoading={resetLoading} type="submit">
                {resetLoading ? copy.resetLoading : copy.resetSubmit}
              </Button>
            ) : null}
          </>
        }
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        title={copy.resetTitle}
      >
        <form className="space-y-4" id="password-reset-form" onSubmit={submitReset}>
          <Field label={copy.resetIdentifier}>
            <TextInput
              onChange={(event) => setResetIdentifier(event.target.value)}
              required
              value={resetIdentifier}
            />
          </Field>
          {resetError ? <Toast message={resetError} tone="danger" /> : null}
          {resetMessage ? <Toast message={resetMessage} tone="success" /> : null}
        </form>
      </Modal>
    </>
  );
}
