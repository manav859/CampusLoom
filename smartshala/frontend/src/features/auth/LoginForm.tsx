"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("principal@smartshala.local");
  const [password, setPassword] = useState("SmartShala@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await authApi.login(identifier, password);
      window.localStorage.setItem("smartshala.accessToken", result.accessToken);
      window.localStorage.setItem("smartshala.refreshToken", result.refreshToken);
      window.localStorage.setItem("smartshala.user", JSON.stringify(result.user));
      router.replace(result.user.role === "TEACHER" ? "/teacher" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block">
        <span className="text-[13px] font-semibold text-[#1d1d1f]">Email or phone</span>
        <input
          className="glass-input mt-2 min-h-[48px] text-[15px]"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-semibold text-[#1d1d1f]">Password</span>
        <input
          className="glass-input mt-2 min-h-[48px] text-[15px]"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</p> : null}
      <button
        className="btn-primary min-h-[48px] w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
