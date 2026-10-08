"use client";

import { useState } from "react";
import { Badge, Btn, Checkbox, DataTable, ErrorBanner, Field, FormModal, Input, PageHeader, RowActions, Select, type Column } from "../../super-admin/_components/ui";
import { useAction } from "../../super-admin/_lib/action";
import { timeAgo } from "../../super-admin/_lib/format";
import { crmFetch } from "../crmFetch";
import { invalidate, useResource } from "../_lib/resource";
import { useCrmUser } from "../_lib/session";
import type { CrmRole, TeamMember } from "../_lib/types";

const ROLE_OPTIONS: Array<{ value: CrmRole; label: string }> = [
  { value: "SALES", label: "Sales — sees own leads" },
  { value: "ADMIN", label: "Sales admin — sees all, manages team" }
];

export default function TeamPage() {
  const user = useCrmUser();
  const team = useResource<TeamMember[]>(user.role === "ADMIN" ? "/team" : null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  if (user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Only a sales admin can manage the team.</p>;
  }

  const columns: Array<Column<TeamMember>> = [
    {
      key: "member",
      header: "Member",
      cell: (member) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{member.name}</p>
          <p className="truncate text-xs text-slate-500">
            {member.email}
            {member.phone ? ` · ${member.phone}` : ""}
          </p>
        </div>
      )
    },
    { key: "role", header: "Role", cell: (member) => <Badge tone={member.role === "ADMIN" ? "info" : "neutral"}>{member.role === "ADMIN" ? "Sales admin" : "Sales"}</Badge> },
    { key: "status", header: "Status", cell: (member) => <Badge tone={member.isActive ? "good" : "danger"}>{member.isActive ? "Active" : "Deactivated"}</Badge> },
    { key: "leads", header: "Leads", align: "right", cell: (member) => <span className="tabular-nums">{member.leadCount}</span> },
    { key: "login", header: "Last sign-in", cell: (member) => <span className="text-xs text-slate-500">{member.lastLoginAt ? timeAgo(member.lastLoginAt) : "Never"}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (member) => (
        <RowActions>
          <Btn onClick={() => setEditing(member)} size="sm">
            Edit
          </Btn>
        </RowActions>
      )
    }
  ];

  return (
    <>
      <PageHeader
        actions={
          <Btn onClick={() => setAdding(true)} variant="primary">
            + Add member
          </Btn>
        }
        description="Who can sign in to the CRM. A deactivated member keeps their leads until you reassign them."
        title="Team"
      />
      {team.error ? <ErrorBanner message={team.error} onRetry={() => void team.reload()} /> : null}
      <DataTable columns={columns} empty="No team members yet." loading={team.isLoading} minWidth={720} rowKey={(member) => member.id} rows={team.data} />

      {adding ? <MemberModal onClose={() => setAdding(false)} /> : null}
      {editing ? <MemberModal member={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function MemberModal({ member, onClose }: { member?: TeamMember; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [draft, setDraft] = useState({
    name: member?.name ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    role: member?.role ?? ("SALES" as CrmRole),
    isActive: member?.isActive ?? true,
    password: ""
  });
  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));
  const valid = draft.name.trim().length >= 2 && (member ? draft.password === "" || draft.password.length >= 8 : draft.email.includes("@") && draft.password.length >= 8);

  return (
    <FormModal
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "member",
          async () => {
            if (member) {
              await crmFetch(`/team/${member.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  name: draft.name,
                  phone: draft.phone,
                  role: draft.role,
                  isActive: draft.isActive,
                  ...(draft.password ? { password: draft.password } : {})
                })
              });
            } else {
              await crmFetch("/team", { method: "POST", body: JSON.stringify(draft) });
            }
            invalidate("/team");
            return true;
          },
          member ? `${draft.name} updated.` : `${draft.name} can now sign in to the CRM.`
        );
        if (done) onClose();
      }}
      open
      submitDisabled={!valid}
      submitLabel={member ? "Save" : "Add member"}
      submitting={isPending("member")}
      title={member ? `Edit ${member.name}` : "Add a team member"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input autoFocus onChange={(event) => set({ name: event.target.value })} required value={draft.name} />
        </Field>
        <Field label="Phone (optional)">
          <Input onChange={(event) => set({ phone: event.target.value })} value={draft.phone} />
        </Field>
        <Field hint={member ? "The sign-in email cannot be changed." : undefined} label="Email">
          <Input disabled={Boolean(member)} onChange={(event) => set({ email: event.target.value })} required type="email" value={draft.email} />
        </Field>
        <Field label="Role">
          <Select ariaLabel="Role" onChange={(role) => set({ role })} options={ROLE_OPTIONS} value={draft.role} />
        </Field>
        <Field className="sm:col-span-2" hint="At least 8 characters. Share it with them securely." label={member ? "New password (leave blank to keep)" : "Password"}>
          <Input minLength={8} onChange={(event) => set({ password: event.target.value })} type="password" value={draft.password} />
        </Field>
      </div>
      {member ? <Checkbox checked={draft.isActive} label="Can sign in" onChange={(isActive) => set({ isActive })} /> : null}
    </FormModal>
  );
}
