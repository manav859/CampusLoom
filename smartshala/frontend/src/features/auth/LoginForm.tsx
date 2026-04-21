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
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-lg border border-line bg-panel p-5 shadow-soft">
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Email or phone</span>
        <input
          className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Password</span>
        <input
          className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button className="focus-ring w-full rounded-lg bg-action px-4 py-2 font-semibold text-white hover:bg-actionDark" disabled={loading}>
        {loading ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
