"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { env } from "@/lib/env";

type SchoolRow = {
  schoolId: string;
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
  planType: string;
  paymentStatus: string;
  isTrial: boolean;
  trialEndsAt: string | null;
  isActive: boolean;
  dbName: string;
  deletionStatus: string;
  deletionScheduledAt: string | null;
  createdAt: string;
};

type TenantUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
};

type UsersPayload = {
  school: {
    schoolId: string;
    schoolName: string;
    dbName: string;
    isActive: boolean;
  };
  users: TenantUser[];
};

const roles: TenantUser["role"][] = ["PRINCIPAL", "ADMIN", "TEACHER", "ACCOUNTANT", "PARENT"];

async function superAdminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const token = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.superAdminToken") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${env.apiBaseUrl}/super-admin${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export default function SuperAdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [usersPayload, setUsersPayload] = useState<UsersPayload | null>(null);
  const [query, setQuery] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const storedToken = window.localStorage.getItem("smartshala.superAdminToken");
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadSchools();
  }, [token]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setUsersPayload(null);
      return;
    }
    void loadUsers(selectedSchoolId);
  }, [selectedSchoolId]);

  const filteredSchools = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return schools;
    return schools.filter((school) =>
      [school.schoolId, school.schoolName, school.ownerName, school.email, school.dbName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(text))
    );
  }, [query, schools]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await superAdminFetch<{ accessToken: string }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      window.localStorage.setItem("smartshala.superAdminToken", result.accessToken);
      setToken(result.accessToken);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login");
    } finally {
      setLoading(false);
    }
  }

  async function loadSchools() {
    setLoading(true);
    setError("");
    try {
      const rows = await superAdminFetch<SchoolRow[]>("/schools");
      setSchools(rows);
      setSelectedSchoolId((current) => current || rows[0]?.schoolId || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load schools");
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers(schoolId: string) {
    setError("");
    try {
      setUsersPayload(await superAdminFetch<UsersPayload>(`/schools/${schoolId}/users`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users");
    }
  }

  async function updateSchoolStatus(school: SchoolRow) {
    setBusyId(school.schoolId);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/schools/${school.schoolId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !school.isActive })
      });
      await loadSchools();
      setNotice(`${school.schoolName} ${school.isActive ? "deactivated" : "activated"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update school status");
    } finally {
      setBusyId("");
    }
  }

  async function updateUserStatus(user: TenantUser) {
    if (!selectedSchoolId) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/schools/${selectedSchoolId}/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive })
      });
      await loadUsers(selectedSchoolId);
      setNotice(`${user.fullName} ${user.isActive ? "deactivated" : "activated"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user status");
    } finally {
      setBusyId("");
    }
  }

  async function updateUserRole(user: TenantUser, role: TenantUser["role"]) {
    if (!selectedSchoolId) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/schools/${selectedSchoolId}/users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      await loadUsers(selectedSchoolId);
      setNotice(`${user.fullName} role updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user role");
    } finally {
      setBusyId("");
    }
  }

  async function resetUserPassword(user: TenantUser) {
    if (!selectedSchoolId) return;
    const nextPassword = resetPasswords[user.id]?.trim();
    if (!nextPassword || nextPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/schools/${selectedSchoolId}/users/${user.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: nextPassword })
      });
      setResetPasswords((current) => ({ ...current, [user.id]: "" }));
      setNotice(`${user.fullName} password changed and old sessions revoked.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setBusyId("");
    }
  }

  function logout() {
    window.localStorage.removeItem("smartshala.superAdminToken");
    setToken(null);
    setSchools([]);
    setUsersPayload(null);
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5">
        <form className="w-full max-w-sm rounded-2xl border border-[#dce3ef] bg-white p-6 shadow-sm" onSubmit={login}>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a6573]">Platform</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[#111827]">Super admin</h1>
          <div className="mt-6 space-y-4">
            <label className="grid gap-2 text-sm font-semibold text-[#1f2937]">
              Email
              <input className="min-h-11 rounded-lg border border-[#dce3ef] px-3 outline-none focus:border-[#2456e6]" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#1f2937]">
              Password
              <input className="min-h-11 rounded-lg border border-[#dce3ef] px-3 outline-none focus:border-[#2456e6]" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <button className="min-h-11 w-full rounded-lg bg-[#2456e6] px-4 text-sm font-bold text-white disabled:opacity-60" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-6 text-[#111827]">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-[#dce3ef] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a6573]">Platform control</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Super admin</h1>
          </div>
          <div className="flex gap-2">
            <button className="min-h-10 rounded-lg border border-[#cbd5e1] bg-white px-4 text-sm font-semibold" onClick={loadSchools} type="button">
              Refresh
            </button>
            <button className="min-h-10 rounded-lg bg-[#111827] px-4 text-sm font-semibold text-white" onClick={logout} type="button">
              Logout
            </button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{notice}</p> : null}

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-[#dce3ef] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Schools</h2>
              <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#2456e6]">{schools.length}</span>
            </div>
            <input
              className="mt-4 min-h-10 w-full rounded-lg border border-[#dce3ef] px-3 text-sm outline-none focus:border-[#2456e6]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search school, owner, email"
              value={query}
            />
            <div className="mt-4 max-h-[calc(100vh-240px)] space-y-2 overflow-auto pr-1">
              {filteredSchools.map((school) => (
                <button
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedSchoolId === school.schoolId ? "border-[#2456e6] bg-[#eef2ff]" : "border-[#eef2f7] bg-white hover:bg-[#f8fafc]"
                  }`}
                  key={school.schoolId}
                  onClick={() => setSelectedSchoolId(school.schoolId)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{school.schoolName}</p>
                      <p className="mt-1 text-xs font-semibold text-[#64748b]">{school.schoolId} · {school.dbName}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${school.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {school.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#64748b]">{school.email}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-5">
            {selectedSchoolId ? (
              <SchoolSummary
                busy={busyId === selectedSchoolId}
                onToggle={updateSchoolStatus}
                school={schools.find((row) => row.schoolId === selectedSchoolId) ?? null}
              />
            ) : null}

            <div className="rounded-2xl border border-[#dce3ef] bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-[#eef2f7] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Users</h2>
                  <p className="text-sm text-[#64748b]">{usersPayload?.school.schoolName ?? "Select a school"}</p>
                </div>
                <span className="text-sm font-semibold text-[#64748b]">{usersPayload?.users.length ?? 0} users</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead className="bg-[#f8fafc] text-left text-xs uppercase tracking-wide text-[#64748b]">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">New password</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersPayload?.users.map((user) => (
                      <tr className="border-t border-[#eef2f7]" key={user.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{user.fullName}</p>
                          <p className="text-xs text-[#64748b]">{user.email ?? user.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="min-h-9 rounded-lg border border-[#dce3ef] bg-white px-2 text-xs font-semibold"
                            disabled={busyId === user.id}
                            onChange={(event) => updateUserRole(user, event.target.value as TenantUser["role"])}
                            value={user.role}
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${user.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="min-h-9 w-48 rounded-lg border border-[#dce3ef] px-2 text-sm outline-none focus:border-[#2456e6]"
                            disabled={busyId === user.id}
                            onChange={(event) => setResetPasswords((current) => ({ ...current, [user.id]: event.target.value }))}
                            placeholder="At least 8 characters"
                            type="password"
                            value={resetPasswords[user.id] ?? ""}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              className="min-h-9 rounded-lg border border-[#cbd5e1] px-3 text-xs font-bold disabled:opacity-60"
                              disabled={busyId === user.id}
                              onClick={() => resetUserPassword(user)}
                              type="button"
                            >
                              Reset
                            </button>
                            <button
                              className={`min-h-9 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-60 ${user.isActive ? "bg-red-600" : "bg-green-600"}`}
                              disabled={busyId === user.id}
                              onClick={() => updateUserStatus(user)}
                              type="button"
                            >
                              {user.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SchoolSummary({ school, busy, onToggle }: { school: SchoolRow | null; busy: boolean; onToggle: (school: SchoolRow) => void }) {
  if (!school) {
    return (
      <div className="rounded-2xl border border-[#dce3ef] bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#64748b]">Select a school to manage users.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dce3ef] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#64748b]">{school.schoolId}</p>
          <h2 className="mt-1 text-2xl font-semibold">{school.schoolName}</h2>
          <p className="mt-2 text-sm text-[#64748b]">{school.ownerName} · {school.email} · {school.phone}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1">{school.planType}</span>
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1">{school.paymentStatus}</span>
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1">{school.deletionStatus}</span>
          </div>
        </div>
        <button
          className={`min-h-10 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60 ${school.isActive ? "bg-red-600" : "bg-green-600"}`}
          disabled={busy}
          onClick={() => onToggle(school)}
          type="button"
        >
          {school.isActive ? "Deactivate school" : "Activate school"}
        </button>
      </div>
    </div>
  );
}
