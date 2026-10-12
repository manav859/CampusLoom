"use client";

import { useState } from "react";
import { Btn, DataTable, ErrorBanner, Field, FormModal, Input, PageHeader, RowActions, type Column } from "../../super-admin/_components/ui";
import { useAction } from "../../super-admin/_lib/action";
import { fmtDate } from "../../super-admin/_lib/format";
import { crmFetch } from "../crmFetch";
import { invalidate, useResource } from "../_lib/resource";
import { useCrmUser } from "../_lib/session";
import type { CustomStage } from "../_lib/types";

export default function StagesPage() {
  const user = useCrmUser();
  const stages = useResource<CustomStage[]>(user.role === "ADMIN" ? "/stages" : null);
  const [adding, setAdding] = useState(false);
  const { run, isPending } = useAction();

  if (user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Only a sales admin can manage deal stages.</p>;
  }

  async function remove(stage: CustomStage) {
    await run(
      `remove:${stage.id}`,
      async () => {
        await crmFetch(`/stages/${stage.id}`, { method: "DELETE" });
        invalidate("/stages");
      },
      `${stage.name} removed.`
    );
  }

  const columns: Array<Column<CustomStage>> = [
    { key: "name", header: "Stage", cell: (stage) => <span className="font-medium">{stage.name}</span> },
    { key: "deals", header: "Deals in it", align: "right", cell: (stage) => <span className="tabular-nums">{stage.dealCount}</span> },
    {
      key: "added",
      header: "Added",
      cell: (stage) => (
        <span className="text-xs text-slate-500">
          {fmtDate(stage.createdAt)} by {stage.createdBy}
        </span>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (stage) => (
        <RowActions>
          <Btn
            disabled={stage.dealCount > 0}
            loading={isPending(`remove:${stage.id}`)}
            onClick={() => void remove(stage)}
            size="sm"
            title={stage.dealCount > 0 ? "Move its deals to another stage first" : undefined}
            variant="danger"
          >
            Remove
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
            + Add stage
          </Btn>
        }
        description="Stages of your own, on top of the built-in ones. The whole team sees them on the board, after Demo shown."
        title="Deal stages"
      />
      {stages.error ? <ErrorBanner message={stages.error} onRetry={() => void stages.reload()} /> : null}
      <DataTable
        columns={columns}
        empty="No custom stages yet."
        loading={stages.isLoading}
        minWidth={560}
        rowKey={(stage) => stage.id}
        rows={stages.data}
      />

      {adding ? <StageModal onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function StageModal({ onClose }: { onClose: () => void }) {
  const { run, isPending } = useAction();
  const [name, setName] = useState("");

  return (
    <FormModal
      onClose={onClose}
      onSubmit={async () => {
        const done = await run(
          "stage",
          async () => {
            await crmFetch("/stages", { method: "POST", body: JSON.stringify({ name }) });
            invalidate("/stages");
            return true;
          },
          `${name.trim()} added.`
        );
        if (done) onClose();
      }}
      open
      submitDisabled={name.trim().length < 2}
      submitLabel="Add stage"
      submitting={isPending("stage")}
      title="Add a deal stage"
    >
      <Field hint="For example: Site visit, Quotation discussed." label="Stage name">
        <Input autoFocus maxLength={40} onChange={(event) => setName(event.target.value)} required value={name} />
      </Field>
    </FormModal>
  );
}
