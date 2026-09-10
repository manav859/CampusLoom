"use client";

import { useState } from "react";
import { useAction } from "../_lib/action";
import { fmtDateTime } from "../_lib/format";
import { invalidate, setResource, useResource } from "../_lib/resource";
import { Btn, DataTable, ErrorBanner, Field, FormModal, Input, PageHeader, RowActions, type Column } from "../_components/ui";
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
  school: { schoolName: string; dbName: string; isActive: boolean };
};

const KEY = "/password-reset-requests";

export default function PasswordResetsPage() {
  const requests = useResource<PasswordResetRequest[]>(KEY);
  const { run, isPending } = useAction();
  const [resetting, setResetting] = useState<PasswordResetRequest | null>(null);

  function dismiss(request: PasswordResetRequest) {
    // Drop it from the list straight away; put the truth back if that fails.
    setResource<PasswordResetRequest[]>(KEY, (current) => (current ?? []).filter((row) => row.id !== request.id));
    void run(
      `dismiss-${request.id}`,
      async () => {
        try {
          await superAdminFetch(`/password-reset-requests/${request.id}/dismiss`, { method: "PATCH" });
        } catch (error) {
          invalidate(KEY);
          throw error;
        }
      },
      `Request from ${request.userName} dismissed.`
    );
  }

  const columns: Array<Column<PasswordResetRequest>> = [
    {
      key: "user",
      header: "User",
      cell: (request) => (
        <div className="min-w-0">
          <p className="font-medium">{request.userName}</p>
          <p className="text-xs text-slate-500">
            {request.role.toLowerCase()} · asked for {request.identifier}
          </p>
        </div>
      )
    },
    {
      key: "school",
      header: "School",
      cell: (request) => (
        <div className="min-w-0">
          <p className="truncate">{request.school.schoolName}</p>
          <p className="text-xs text-slate-500">{request.schoolId}</p>
        </div>
      )
    },
    { key: "when", header: "Requested", cell: (request) => <span className="text-slate-600">{fmtDateTime(request.requestedAt)}</span> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (request) => (
        <RowActions>
          <Btn onClick={() => setResetting(request)} size="sm" variant="primary">
            Set new password
          </Btn>
          <Btn disabled={isPending(`dismiss-${request.id}`)} onClick={() => dismiss(request)} size="sm">
            Dismiss
          </Btn>
        </RowActions>
      )
    }
  ];

  return (
    <>
      <PageHeader
        actions={
          <Btn loading={requests.isRefreshing} onClick={() => void requests.reload()} size="sm">
            Refresh
          </Btn>
        }
        description="People who could not sign in and asked for help. Verify who they are before setting a password."
        title="Password resets"
      />
      {requests.error ? <ErrorBanner message={requests.error} onRetry={() => void requests.reload()} /> : null}
      <DataTable columns={columns} empty="No pending requests." loading={requests.isLoading} rowKey={(request) => request.id} rows={requests.data} />
      {resetting ? <CompleteResetModal onClose={() => setResetting(null)} request={resetting} /> : null}
    </>
  );
}

function CompleteResetModal({ request, onClose }: { request: PasswordResetRequest; onClose: () => void }) {
  const { run, isPending } = useAction();
  const [password, setPassword] = useState("");

  return (
    <FormModal
      description={`${request.school.schoolName} · ${request.identifier}`}
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "complete-reset",
          async () => {
            await superAdminFetch(`/password-reset-requests/${request.id}/complete`, { method: "PATCH", body: JSON.stringify({ password }) });
            setResource<PasswordResetRequest[]>(KEY, (current) => (current ?? []).filter((row) => row.id !== request.id));
            invalidate(`/schools/${request.schoolId}/users`);
            return true;
          },
          `Password set for ${request.userName}.`
        );
        if (done) onClose();
      }}
      open
      submitDisabled={password.length < 8}
      submitLabel="Set password"
      submitting={isPending("complete-reset")}
      title={`New password for ${request.userName}`}
    >
      <Field hint="At least 8 characters. Tell the user over a channel you trust." label="New password">
        <Input autoFocus minLength={8} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
      </Field>
    </FormModal>
  );
}
