"use client";

import { useEffect, useState } from "react";
import { superAdminFetch } from "../superAdminFetch";

type PasswordResetRequest = {
  id: string;
  schoolId: string;
  userId: string;
  userName: string;
  email: string | null;
  phone: string;
  role: string;
  identifier: string;
  status: "PENDING" | "COMPLETED" | "DISMISSED";
  requestedAt: string;
  school: {
    schoolName: string;
    dbName: string;
    isActive: boolean;
  };
};

export default function PasswordResetsPage() {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRequests(await superAdminFetch<PasswordResetRequest[]>("/password-reset-requests"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load password reset requests");
    } finally {
      setLoading(false);
    }
  }

  async function complete(request: PasswordResetRequest) {
    const nextPassword = passwords[request.id]?.trim();
    if (!nextPassword || nextPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/password-reset-requests/${request.id}/complete`, {
        method: "PATCH",
        body: JSON.stringify({ password: nextPassword })
      });
      setPasswords((current) => ({ ...current, [request.id]: "" }));
      await load();
      setNotice(`${request.userName} password changed and request completed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete password reset");
    } finally {
      setBusyId("");
    }
  }

  async function dismiss(request: PasswordResetRequest) {
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/password-reset-requests/${request.id}/dismiss`, { method: "PATCH" });
      await load();
      setNotice(`Password reset request for ${request.userName} dismissed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to dismiss password reset request");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-[#dce3ef] pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Password resets</h1>
          <p className="mt-1 text-sm text-[#64748b]">Set a new password for verified users, or dismiss old requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#c2410c]">{requests.length} pending</span>
          <button
            className="min-h-10 rounded-lg border border-[#cbd5e1] bg-white px-4 text-sm font-semibold disabled:opacity-60"
            disabled={loading}
            onClick={load}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{notice}</p> : null}

      <section className="rounded-2xl border border-[#dce3ef] bg-white shadow-sm">
        {requests.length ? (
          <div className="divide-y divide-[#eef2f7]">
            {requests.map((request) => (
              <div className="grid gap-3 p-4 lg:grid-cols-[1fr_260px_auto] lg:items-center" key={request.id}>
                <div>
                  <p className="font-semibold">{request.userName}</p>
                  <p className="mt-1 text-sm text-[#64748b]">
                    {request.school.schoolName} · {request.schoolId} · {request.role}
                  </p>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Requested for {request.identifier} on {new Date(request.requestedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <input
                  className="min-h-10 rounded-lg border border-[#dce3ef] px-3 text-sm outline-none focus:border-[#2456e6]"
                  disabled={busyId === request.id}
                  onChange={(event) => setPasswords((current) => ({ ...current, [request.id]: event.target.value }))}
                  placeholder="New password"
                  type="password"
                  value={passwords[request.id] ?? ""}
                />
                <div className="flex gap-2 lg:justify-end">
                  <button
                    className="min-h-10 rounded-lg bg-[#2456e6] px-4 text-xs font-bold text-white disabled:opacity-60"
                    disabled={busyId === request.id}
                    onClick={() => complete(request)}
                    type="button"
                  >
                    Set new password
                  </button>
                  <button
                    className="min-h-10 rounded-lg border border-[#cbd5e1] px-4 text-xs font-bold disabled:opacity-60"
                    disabled={busyId === request.id}
                    onClick={() => dismiss(request)}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm font-semibold text-[#64748b]">No pending password reset requests.</p>
        )}
      </section>
    </div>
  );
}
