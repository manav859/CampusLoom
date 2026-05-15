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
      languageLabel: "\u092D\u093E\u0937\u093E",
      identifier: "\u0908\u092E\u0947\u0932 \u092F\u093E \u092B\u094B\u0928",
      password: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921",
      showPassword: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0926\u093F\u0916\u093E\u090F\u0902",
      hidePassword: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u091B\u093F\u092A\u093E\u090F\u0902",
      forgot: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u092D\u0942\u0932 \u0917\u090F?",
      support: "\u0938\u093E\u0907\u0928 \u0907\u0928 \u092E\u0947\u0902 \u092A\u0930\u0947\u0936\u093E\u0928\u0940? +91-98765-43210 \u092A\u0930 \u0915\u0949\u0932 \u0915\u0930\u0947\u0902",
      submit: "\u0938\u093E\u0907\u0928 \u0907\u0928 \u0915\u0930\u0947\u0902",
      loading: "\u0938\u093E\u0907\u0928 \u0907\u0928 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...",
      resetTitle: "\u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u0930\u0940\u0938\u0947\u091F",
      resetIntro: "\u0905\u092A\u0928\u093E \u092A\u0902\u091C\u0940\u0915\u0943\u0924 \u0908\u092E\u0947\u0932 \u092F\u093E \u092B\u094B\u0928 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902\u0964 \u0905\u0928\u0941\u0930\u094B\u0927 \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0939\u094B\u0917\u093E \u0914\u0930 \u092A\u093E\u0938\u0935\u0930\u094D\u0921 \u092C\u0926\u0932\u0928\u0947 \u0938\u0947 \u092A\u0939\u0932\u0947 \u0938\u092A\u094B\u0930\u094D\u091F \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0915\u0930\u0947\u0917\u093E\u0964",
      resetIdentifier: "\u092A\u0902\u091C\u0940\u0915\u0943\u0924 \u0908\u092E\u0947\u0932 \u092F\u093E \u092B\u094B\u0928",
      resetSubmit: "\u0930\u0940\u0938\u0947\u091F \u0905\u0928\u0941\u0930\u094B\u0927 \u092D\u0947\u091C\u0947\u0902",
      resetLoading: "\u0905\u0928\u0941\u0930\u094B\u0927 \u092D\u0947\u091C\u093E \u091C\u093E \u0930\u0939\u093E \u0939\u0948...",
      resetCancel: "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902",
      resetDone: "\u0930\u0940\u0938\u0947\u091F \u0905\u0928\u0941\u0930\u094B\u0927 \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0939\u094B \u0917\u092F\u093E\u0964 \u0938\u092A\u094B\u0930\u094D\u091F \u0938\u094D\u0915\u0942\u0932 \u090F\u0921\u092E\u093F\u0928 \u0938\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0917\u093E\u0964",
      close: "\u092C\u0902\u0926 \u0915\u0930\u0947\u0902"
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
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5A6573] hover:bg-[#F7F8FB] hover:text-[#2456E6]"
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
        <Button className="w-full" isLoading={loading} size="lg" type="submit">
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
