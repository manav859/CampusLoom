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

const roles: TenantUser["role"][] = ["PRINCIPAL", "ADMIN", "TEACHER", "ACCOUNTANT", "PARENT"];

function schoolStatusLabel(school: SchoolRow) {
  if (school.deletionStatus === "PENDING") return "Scheduled for deletion";
  if (school.deletionStatus === "DELETED") return "Deleted";
  if (school.deletionStatus === "FAILED") return "Deletion failed";
  if (!school.isActive && school.paymentStatus === "PENDING") return "Awaiting approval";
  return school.isActive ? "Active" : "Inactive";
}

function schoolStatusClass(school: SchoolRow) {
  if (school.deletionStatus === "PENDING") return "bg-amber-50 text-amber-800";
  if (school.deletionStatus === "DELETED" || school.deletionStatus === "FAILED") return "bg-red-50 text-red-700";
  if (!school.isActive && school.paymentStatus === "PENDING") return "bg-blue-50 text-blue-700";
  return school.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700";
}

function deletionTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function trialText(school: SchoolRow) {
  if (!school.isTrial) return null;
  if (!school.trialEndsAt) return "Trial starts after approval";
  return `Trial ends ${deletionTime(school.trialEndsAt)}`;
}

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

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export default function SuperAdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [usersPayload, setUsersPayload] = useState<UsersPayload | null>(null);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [query, setQuery] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [requestPasswords, setRequestPasswords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", phone: "", password: "", role: "TEACHER" as TenantUser["role"] });

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
      [school.schoolId, school.schoolName, school.ownerName, school.email, school.dbName, schoolStatusLabel(school)]
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
      const [rows, requests] = await Promise.all([
        superAdminFetch<SchoolRow[]>("/schools"),
        superAdminFetch<PasswordResetRequest[]>("/password-reset-requests")
      ]);
      setSchools(rows);
      setResetRequests(requests);
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
      setNotice(`${school.schoolName} ${school.isActive ? "revoked" : "granted access"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update school status");
    } finally {
      setBusyId("");
    }
  }

  async function extendAccess(school: SchoolRow) {
    setBusyId(school.schoolId);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/schools/${school.schoolId}/extend-access`, {
        method: "PATCH",
        body: JSON.stringify({ days: 30 })
      });
      await loadSchools();
      setNotice(`${school.schoolName} access extended by 30 days.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to extend school access");
    } finally {
      setBusyId("");
    }
  }

  async function handleDeleteSchool(school: SchoolRow) {
    const confirmed = window.confirm(`Are you sure you want to permanently delete "${school.schoolName}" (${school.schoolId})?\n\nThis will remove the school database and cannot be undone.`);
    if (!confirmed) return;
    setBusyId(school.schoolId);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/schools/${school.schoolId}`, { method: "DELETE" });
      setSelectedSchoolId("");
      await loadSchools();
      setNotice(`${school.schoolName} has been deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete school");
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

  async function completeResetRequest(request: PasswordResetRequest) {
    const nextPassword = requestPasswords[request.id]?.trim();
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
      setRequestPasswords((current) => ({ ...current, [request.id]: "" }));
      await loadSchools();
      if (selectedSchoolId === request.schoolId) await loadUsers(selectedSchoolId);
      setNotice(`${request.userName} password changed and request completed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete password reset");
    } finally {
      setBusyId("");
    }
  }

  async function dismissResetRequest(request: PasswordResetRequest) {
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/password-reset-requests/${request.id}/dismiss`, { method: "PATCH" });
      await loadSchools();
      setNotice(`Password reset request for ${request.userName} dismissed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to dismiss password reset request");
    } finally {
      setBusyId("");
    }
  }

  async function createUser() {
    if (!selectedSchoolId) return;
    if (!newUser.fullName.trim() || !newUser.phone.trim() || newUser.password.length < 8) {
      setError("Name, phone, and password (min 8 chars) are required.");
      return;
    }
    setBusyId("new-user");
    setError("");
    setNotice("");
    try {
      await superAdminFetch(`/schools/${selectedSchoolId}/users`, {
        method: "POST",
        body: JSON.stringify({
          fullName: newUser.fullName.trim(),
          email: newUser.email.trim() || undefined,
          phone: newUser.phone.trim(),
          password: newUser.password,
          role: newUser.role
        })
      });
      setNewUser({ fullName: "", email: "", phone: "", password: "", role: "TEACHER" });
      setShowAddUser(false);
      await loadUsers(selectedSchoolId);
      setNotice(`User ${newUser.fullName} created successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user");
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

        <section className="rounded-2xl border border-[#dce3ef] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#eef2f7] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Forgot password requests</h2>
              <p className="text-sm text-[#64748b]">Set a new password for verified users, or dismiss old requests.</p>
            </div>
            <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#c2410c]">{resetRequests.length} pending</span>
          </div>
          {resetRequests.length ? (
            <div className="divide-y divide-[#eef2f7]">
              {resetRequests.map((request) => (
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
                    onChange={(event) => setRequestPasswords((current) => ({ ...current, [request.id]: event.target.value }))}
                    placeholder="New password"
                    type="password"
                    value={requestPasswords[request.id] ?? ""}
                  />
                  <div className="flex gap-2 lg:justify-end">
                    <button
                      className="min-h-10 rounded-lg bg-[#2456e6] px-4 text-xs font-bold text-white disabled:opacity-60"
                      disabled={busyId === request.id}
                      onClick={() => completeResetRequest(request)}
                      type="button"
                    >
                      Set new password
                    </button>
                    <button
                      className="min-h-10 rounded-lg border border-[#cbd5e1] px-4 text-xs font-bold disabled:opacity-60"
                      disabled={busyId === request.id}
                      onClick={() => dismissResetRequest(request)}
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
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${schoolStatusClass(school)}`}>
                      {schoolStatusLabel(school)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#64748b]">{school.email}</p>
                  {school.deletionStatus === "PENDING" ? (
                    <p className="mt-1 text-xs font-semibold text-amber-800">
                      Deletes {deletionTime(school.deletionScheduledAt) ?? "after cancellation window"}
                    </p>
                  ) : null}
                  {trialText(school) ? <p className="mt-1 text-xs font-semibold text-[#64748b]">{trialText(school)}</p> : null}
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-5">
            {selectedSchoolId ? (
              <SchoolSummary
                busy={busyId === selectedSchoolId}
                onDelete={handleDeleteSchool}
                onExtend={extendAccess}
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
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#64748b]">{usersPayload?.users.length ?? 0} users</span>
                  {selectedSchoolId ? (
                    <button
                      className="min-h-9 rounded-lg bg-[#2456e6] px-4 text-xs font-bold text-white disabled:opacity-60"
                      disabled={!selectedSchoolId}
                      onClick={() => setShowAddUser((v) => !v)}
                      type="button"
                    >
                      {showAddUser ? "Cancel" : "+ Add user"}
                    </button>
                  ) : null}
                </div>
              </div>
              {showAddUser && selectedSchoolId ? (
                <div className="border-b border-[#eef2f7] bg-[#f8fafc] p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <input
                      className="min-h-10 rounded-lg border border-[#dce3ef] px-3 text-sm outline-none focus:border-[#2456e6]"
                      disabled={busyId === "new-user"}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      placeholder="Full name *"
                      value={newUser.fullName}
                    />
                    <input
                      className="min-h-10 rounded-lg border border-[#dce3ef] px-3 text-sm outline-none focus:border-[#2456e6]"
                      disabled={busyId === "new-user"}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="Email (optional)"
                      type="email"
                      value={newUser.email}
                    />
                    <input
                      className="min-h-10 rounded-lg border border-[#dce3ef] px-3 text-sm outline-none focus:border-[#2456e6]"
                      disabled={busyId === "new-user"}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      placeholder="Phone *"
                      value={newUser.phone}
                    />
                    <input
                      className="min-h-10 rounded-lg border border-[#dce3ef] px-3 text-sm outline-none focus:border-[#2456e6]"
                      disabled={busyId === "new-user"}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Password (min 8 chars) *"
                      type="password"
                      value={newUser.password}
                    />
                    <select
                      className="min-h-10 rounded-lg border border-[#dce3ef] bg-white px-3 text-sm font-semibold"
                      disabled={busyId === "new-user"}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as TenantUser["role"] })}
                      value={newUser.role}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <button
                      className="min-h-10 rounded-lg bg-[#2456e6] px-4 text-sm font-bold text-white disabled:opacity-60"
                      disabled={busyId === "new-user"}
                      onClick={createUser}
                      type="button"
                    >
                      {busyId === "new-user" ? "Creating..." : "Create user"}
                    </button>
                  </div>
                </div>
              ) : null}
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
                              Save password
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

function SchoolSummary({
  school,
  busy,
  onDelete,
  onExtend,
  onToggle
}: {
  school: SchoolRow | null;
  busy: boolean;
  onDelete: (school: SchoolRow) => void;
  onExtend: (school: SchoolRow) => void;
  onToggle: (school: SchoolRow) => void;
}) {
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
          {school.deletionStatus === "PENDING" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Scheduled for deletion{deletionTime(school.deletionScheduledAt) ? ` on ${deletionTime(school.deletionScheduledAt)}` : ""}.
            </div>
          ) : null}
          {!school.isActive && school.paymentStatus === "PENDING" ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
              Waiting for super admin approval. Grant access to start the 30-day trial.
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1">{school.planType}</span>
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1">{school.paymentStatus}</span>
            <span className={`rounded-full px-3 py-1 ${schoolStatusClass(school)}`}>{schoolStatusLabel(school)}</span>
            {trialText(school) ? <span className="rounded-full bg-[#f1f5f9] px-3 py-1">{trialText(school)}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {!school.isActive ? (
            <button
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
              disabled={busy}
              onClick={() => onExtend(school)}
              type="button"
            >
              Extend 30 days
            </button>
          ) : null}
          <button
            className={`min-h-10 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60 ${school.isActive ? "bg-red-600" : "bg-green-600"}`}
            disabled={busy}
            onClick={() => onToggle(school)}
            type="button"
          >
            {school.isActive ? "Revoke access" : "Grant access"}
          </button>
          {school.deletionStatus !== "DELETED" ? (
            <button
              className="min-h-10 rounded-lg border border-red-300 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              disabled={busy}
              onClick={() => onDelete(school)}
              type="button"
            >
              Delete school
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
