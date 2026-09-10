"use client";

import { useMemo, useState } from "react";
import { useAction } from "./_lib/action";
import { fmtDateTime } from "./_lib/format";
import { invalidate, setResource, useResource } from "./_lib/resource";
import {
  Badge,
  Btn,
  Card,
  CardHeader,
  ConfirmModal,
  DataTable,
  ErrorBanner,
  Field,
  FormModal,
  Input,
  PageHeader,
  RowActions,
  Select,
  cx,
  type Column
} from "./_components/ui";
import type { Tone } from "./_lib/format";
import { superAdminFetch } from "./superAdminFetch";

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

type Role = "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";

type TenantUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
};

type UsersPayload = {
  school: { schoolId: string; schoolName: string; dbName: string; isActive: boolean };
  users: TenantUser[];
};

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "PRINCIPAL", label: "Principal" },
  { value: "ADMIN", label: "Admin" },
  { value: "TEACHER", label: "Teacher" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "PARENT", label: "Parent" }
];

function schoolStatus(school: SchoolRow): { label: string; tone: Tone } {
  if (school.deletionStatus === "PENDING") return { label: "Deletion scheduled", tone: "warn" };
  if (school.deletionStatus === "DELETED") return { label: "Deleted", tone: "danger" };
  if (school.deletionStatus === "FAILED") return { label: "Deletion failed", tone: "danger" };
  if (!school.isActive && school.paymentStatus === "PENDING") return { label: "Awaiting approval", tone: "info" };
  return school.isActive ? { label: "Active", tone: "good" } : { label: "Inactive", tone: "danger" };
}

function trialText(school: SchoolRow) {
  if (!school.isTrial) return null;
  return school.trialEndsAt ? `Trial ends ${fmtDateTime(school.trialEndsAt)}` : "Trial starts after approval";
}

export default function SuperAdminSchoolsPage() {
  const schools = useResource<SchoolRow[]>("/schools");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");

  // Default to the first school without an extra render-and-set round trip.
  const selectedId = picked || schools.data?.[0]?.schoolId || "";
  const selected = schools.data?.find((row) => row.schoolId === selectedId) ?? null;

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text || !schools.data) return schools.data ?? [];
    return schools.data.filter((school) =>
      [school.schoolId, school.schoolName, school.ownerName, school.email, school.dbName, schoolStatus(school).label]
        .some((value) => value?.toLowerCase().includes(text))
    );
  }, [query, schools.data]);

  return (
    <>
      <PageHeader
        actions={
          <Btn loading={schools.isRefreshing} onClick={() => void schools.reload()} size="sm">
            Refresh
          </Btn>
        }
        description="Tenant access, trials, and the staff accounts inside each school."
        title="Schools & users"
      />

      {schools.error ? <ErrorBanner message={schools.error} onRetry={() => void schools.reload()} /> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="self-start">
          <div className="border-b border-slate-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Schools</h2>
              <span className="text-xs font-semibold text-slate-500">{schools.data?.length ?? 0}</span>
            </div>
            <Input onChange={(event) => setQuery(event.target.value)} placeholder="Search school, owner, email" value={query} />
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-1.5">
            {schools.isLoading ? <p className="p-3 text-sm text-slate-500">Loading schools…</p> : null}
            {filtered.map((school) => {
              const status = schoolStatus(school);
              return (
                <button
                  className={cx(
                    "mb-1 w-full rounded-md px-2.5 py-2 text-left transition-colors",
                    selectedId === school.schoolId ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50"
                  )}
                  key={school.schoolId}
                  onClick={() => setPicked(school.schoolId)}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{school.schoolName}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {school.schoolId} · {school.email}
                  </span>
                  {trialText(school) ? <span className="mt-0.5 block text-xs text-slate-500">{trialText(school)}</span> : null}
                </button>
              );
            })}
            {schools.data && filtered.length === 0 ? <p className="p-3 text-sm text-slate-500">No schools match.</p> : null}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          {selected ? <SchoolSummary school={selected} onDeleted={() => setPicked("")} /> : null}
          {selected ? <UsersCard schoolId={selected.schoolId} /> : null}
          {!selected && schools.data?.length === 0 ? (
            <Card className="p-4 text-sm text-slate-500">No schools have signed up yet.</Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function SchoolSummary({ school, onDeleted }: { school: SchoolRow; onDeleted: () => void }) {
  const { run, isPending } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = schoolStatus(school);
  const busy = isPending(`school-${school.schoolId}`);

  const act = (work: () => Promise<unknown>, message: string) =>
    run(`school-${school.schoolId}`, async () => {
      await work();
      invalidate("/schools", "/billing/");
    }, message);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-500">{school.schoolId}</p>
          <h2 className="truncate text-lg font-semibold">{school.schoolName}</h2>
          <p className="mt-0.5 break-words text-sm text-slate-500">
            {school.ownerName} · {school.email} · {school.phone}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge>{school.planType}</Badge>
            <Badge>{school.paymentStatus}</Badge>
            {trialText(school) ? <Badge tone="info">{trialText(school)}</Badge> : null}
          </div>
          {!school.isActive && school.paymentStatus === "PENDING" ? (
            <p className="mt-2 text-sm text-blue-800">Waiting for approval — grant access to start the 30-day trial.</p>
          ) : null}
          {school.deletionStatus === "PENDING" && school.deletionScheduledAt ? (
            <p className="mt-2 text-sm text-amber-800">Scheduled for deletion on {fmtDateTime(school.deletionScheduledAt)}.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!school.isActive ? (
            <Btn
              disabled={busy}
              onClick={() =>
                void act(
                  () => superAdminFetch(`/schools/${school.schoolId}/extend-access`, { method: "PATCH", body: JSON.stringify({ days: 30 }) }),
                  `${school.schoolName}: access extended by 30 days.`
                )
              }
              size="sm"
            >
              Extend 30 days
            </Btn>
          ) : null}
          <Btn
            loading={busy}
            onClick={() =>
              void act(
                () => superAdminFetch(`/schools/${school.schoolId}/status`, { method: "PATCH", body: JSON.stringify({ isActive: !school.isActive }) }),
                `${school.schoolName}: ${school.isActive ? "access revoked" : "access granted"}.`
              )
            }
            size="sm"
            variant={school.isActive ? "danger" : "primary"}
          >
            {school.isActive ? "Revoke access" : "Grant access"}
          </Btn>
          {school.deletionStatus !== "DELETED" ? (
            <Btn disabled={busy} onClick={() => setConfirmDelete(true)} size="sm" variant="danger">
              Delete school
            </Btn>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        busy={busy}
        confirmLabel="Delete permanently"
        danger
        message={
          <>
            This removes <strong>{school.schoolName}</strong> ({school.schoolId}) and its database. It cannot be undone.
          </>
        }
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const done = await run(
            `school-${school.schoolId}`,
            async () => {
              await superAdminFetch(`/schools/${school.schoolId}`, { method: "DELETE" });
              invalidate("/schools", "/billing/");
              return true;
            },
            `${school.schoolName} has been deleted.`
          );
          if (done) {
            setConfirmDelete(false);
            onDeleted();
          }
        }}
        open={confirmDelete}
        title="Delete this school?"
      />
    </Card>
  );
}

function UsersCard({ schoolId }: { schoolId: string }) {
  const key = `/schools/${schoolId}/users`;
  const users = useResource<UsersPayload>(key);
  const { run, isPending } = useAction();
  const [adding, setAdding] = useState(false);
  const [passwordFor, setPasswordFor] = useState<TenantUser | null>(null);

  /** Show the change at once; if the server refuses, reload the truth. */
  function patchUser(user: TenantUser, patch: Partial<TenantUser>, path: string, body: object, message: string) {
    setResource<UsersPayload>(key, (current) =>
      current ? { ...current, users: current.users.map((row) => (row.id === user.id ? { ...row, ...patch } : row)) } : current!
    );
    void run(
      `user-${user.id}`,
      async () => {
        try {
          await superAdminFetch(`/schools/${schoolId}/users/${user.id}/${path}`, { method: "PATCH", body: JSON.stringify(body) });
        } catch (error) {
          invalidate(key);
          throw error;
        }
      },
      message
    );
  }

  const columns: Array<Column<TenantUser>> = [
    {
      key: "user",
      header: "User",
      cell: (user) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-slate-500">{user.email ?? user.phone}</p>
        </div>
      )
    },
    {
      key: "role",
      header: "Role",
      className: "w-40",
      cell: (user) => (
        <Select
          ariaLabel={`Role for ${user.fullName}`}
          onChange={(role) => {
            if (role !== user.role) patchUser(user, { role }, "role", { role }, `${user.fullName} is now ${role.toLowerCase()}.`);
          }}
          options={ROLE_OPTIONS}
          value={user.role}
        />
      )
    },
    {
      key: "status",
      header: "Status",
      cell: (user) => <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Inactive"}</Badge>
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (user) => (
        <RowActions>
          <Btn onClick={() => setPasswordFor(user)} size="sm">
            Set password
          </Btn>
          <Btn
            disabled={isPending(`user-${user.id}`)}
            onClick={() =>
              patchUser(user, { isActive: !user.isActive }, "status", { isActive: !user.isActive }, `${user.fullName} ${user.isActive ? "deactivated" : "activated"}.`)
            }
            size="sm"
            variant={user.isActive ? "danger" : "primary"}
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </Btn>
        </RowActions>
      )
    }
  ];

  return (
    <Card>
      <CardHeader
        actions={
          <Btn onClick={() => setAdding(true)} size="sm" variant="primary">
            + Add user
          </Btn>
        }
        description={users.data ? `${users.data.users.length} users in ${users.data.school.schoolName}` : "Loading…"}
        title="Users"
      />
      <div className="p-3">
        {users.error ? <ErrorBanner message={users.error} onRetry={() => void users.reload()} /> : null}
        <DataTable columns={columns} loading={users.isLoading} minWidth={560} rowKey={(user) => user.id} rows={users.data?.users} />
      </div>

      {adding ? <AddUserModal onClose={() => setAdding(false)} schoolId={schoolId} /> : null}
      {passwordFor ? <SetPasswordModal onClose={() => setPasswordFor(null)} schoolId={schoolId} user={passwordFor} /> : null}
    </Card>
  );
}

function AddUserModal({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [draft, setDraft] = useState({ fullName: "", email: "", phone: "", password: "", role: "TEACHER" as Role });
  const valid = draft.fullName.trim() && draft.phone.trim() && draft.password.length >= 8;

  return (
    <FormModal
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "add-user",
          async () => {
            await superAdminFetch(`/schools/${schoolId}/users`, {
              method: "POST",
              body: JSON.stringify({
                fullName: draft.fullName.trim(),
                email: draft.email.trim() || undefined,
                phone: draft.phone.trim(),
                password: draft.password,
                role: draft.role
              })
            });
            invalidate(`/schools/${schoolId}/users`);
            return true;
          },
          `${draft.fullName.trim()} added.`
        );
        if (done) onClose();
      }}
      open
      submitDisabled={!valid}
      submitLabel="Create user"
      submitting={isPending("add-user")}
      title="Add a user"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input autoFocus onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} required value={draft.fullName} />
        </Field>
        <Field label="Role">
          <Select ariaLabel="Role" onChange={(role) => setDraft({ ...draft, role })} options={ROLE_OPTIONS} value={draft.role} />
        </Field>
        <Field label="Phone">
          <Input onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required value={draft.phone} />
        </Field>
        <Field label="Email (optional)">
          <Input onChange={(event) => setDraft({ ...draft, email: event.target.value })} type="email" value={draft.email} />
        </Field>
        <Field className="sm:col-span-2" hint="At least 8 characters. Share it with the user securely." label="Password">
          <Input minLength={8} onChange={(event) => setDraft({ ...draft, password: event.target.value })} required type="password" value={draft.password} />
        </Field>
      </div>
    </FormModal>
  );
}

function SetPasswordModal({ schoolId, user, onClose }: { schoolId: string; user: TenantUser; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [password, setPassword] = useState("");

  return (
    <FormModal
      description="Their other sessions are signed out."
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "set-password",
          async () => {
            await superAdminFetch(`/schools/${schoolId}/users/${user.id}/password`, { method: "PATCH", body: JSON.stringify({ password }) });
            return true;
          },
          `Password changed for ${user.fullName}.`
        );
        if (done) onClose();
      }}
      open
      submitDisabled={password.length < 8}
      submitLabel="Save password"
      submitting={isPending("set-password")}
      title={`New password for ${user.fullName}`}
    >
      <Field hint="At least 8 characters." label="New password">
        <Input autoFocus minLength={8} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
      </Field>
    </FormModal>
  );
}
