"use client";

import { useState } from "react";
import { Field, FormModal, Input, Select, TextArea } from "../../super-admin/_components/ui";
import { useAction } from "../../super-admin/_lib/action";
import { crmFetch } from "../crmFetch";
import { GST_STATES } from "../_lib/format";
import { invalidate, useResource } from "../_lib/resource";
import { useCrmUser } from "../_lib/session";
import type { LeadContact, LeadDetail, LeadRow, TeamMember } from "../_lib/types";

type Draft = Record<keyof LeadContact, string> & { assignedToId: string };

function toDraft(lead?: LeadDetail): Draft {
  return {
    schoolName: lead?.schoolName ?? "",
    ownerName: lead?.ownerName ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    address: lead?.address ?? "",
    gstin: lead?.gstin ?? "",
    stateName: lead?.stateName ?? "",
    stateCode: lead?.stateCode ?? "",
    numberOfStudents: lead?.numberOfStudents?.toString() ?? "",
    numberOfStaff: lead?.numberOfStaff?.toString() ?? "",
    assignedToId: lead?.assignedToId ?? ""
  };
}

const STATE_OPTIONS = [{ value: "", label: "Not set" }, ...GST_STATES.map((state) => ({ value: state.code, label: `${state.name} (${state.code})` }))];

/**
 * Add a lead, or edit one. The same principal contacts the old manual school
 * form took — they become the school and its principal login once it pays.
 */
export function LeadFormModal({ lead, onClose, onCreated }: { lead?: LeadDetail; onClose: () => void; onCreated?: (lead: LeadRow) => void }) {
  const user = useCrmUser();
  const isAdmin = user.role === "ADMIN";
  const team = useResource<TeamMember[]>(isAdmin ? "/team" : null);
  const { run, isPending } = useAction();
  const [draft, setDraft] = useState<Draft>(() => toDraft(lead));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const valid = draft.schoolName.trim().length >= 2 && draft.ownerName.trim().length >= 2 && draft.email.includes("@") && draft.phone.trim().length >= 10;

  const ownerOptions = [
    { value: "", label: "Unassigned" },
    ...(team.data ?? []).filter((member) => member.isActive || member.id === draft.assignedToId).map((member) => ({ value: member.id, label: member.name }))
  ];

  async function submit() {
    const body = {
      schoolName: draft.schoolName,
      ownerName: draft.ownerName,
      email: draft.email,
      phone: draft.phone,
      address: draft.address,
      gstin: draft.gstin,
      stateName: draft.stateName,
      stateCode: draft.stateCode,
      numberOfStudents: draft.numberOfStudents,
      numberOfStaff: draft.numberOfStaff,
      ...(isAdmin ? { assignedToId: draft.assignedToId } : {})
    };
    const done = await run(
      "lead-form",
      async () => {
        if (lead) {
          await crmFetch(`/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify(body) });
          invalidate("/leads");
          return null;
        }
        const created = await crmFetch<LeadRow>("/leads", { method: "POST", body: JSON.stringify(body) });
        invalidate("/leads");
        return created;
      },
      lead ? "Lead updated." : (created) => `${created?.code} created.`
    );
    if (done === undefined) return;
    if (done) onCreated?.(done);
    onClose();
  }

  return (
    <FormModal
      onClose={onClose}
      onSubmit={() => void submit()}
      open
      size="lg"
      submitDisabled={!valid}
      submitLabel={lead ? "Save changes" : "Create lead"}
      submitting={isPending("lead-form")}
      title={lead ? `Edit ${lead.code}` : "Add a lead"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="School name">
          <Input autoFocus onChange={(event) => set({ schoolName: event.target.value })} required value={draft.schoolName} />
        </Field>
        <Field label="Principal / owner name">
          <Input onChange={(event) => set({ ownerName: event.target.value })} required value={draft.ownerName} />
        </Field>
        <Field hint="Becomes the principal's login." label="Principal's email">
          <Input onChange={(event) => set({ email: event.target.value })} required type="email" value={draft.email} />
        </Field>
        <Field hint="Payment links and login details go here on WhatsApp." label="Principal's phone">
          <Input inputMode="tel" onChange={(event) => set({ phone: event.target.value })} required value={draft.phone} />
        </Field>
        <Field label="Students">
          <Input inputMode="numeric" min={0} onChange={(event) => set({ numberOfStudents: event.target.value })} type="number" value={draft.numberOfStudents} />
        </Field>
        <Field label="Staff">
          <Input inputMode="numeric" min={0} onChange={(event) => set({ numberOfStaff: event.target.value })} type="number" value={draft.numberOfStaff} />
        </Field>
        <Field className="sm:col-span-2" label="Address">
          <TextArea onChange={(event) => set({ address: event.target.value })} placeholder="Street, city, PIN code" value={draft.address} />
        </Field>
        <Field hint="Leave blank if the school is not GST registered." label="GSTIN">
          <Input
            maxLength={15}
            onChange={(event) => {
              const gstin = event.target.value.toUpperCase();
              const state = GST_STATES.find((entry) => entry.code === gstin.slice(0, 2));
              set({ gstin, ...(state && gstin.length >= 2 ? { stateCode: state.code, stateName: state.name } : {}) });
            }}
            value={draft.gstin}
          />
        </Field>
        <Field hint="Decides CGST + SGST or IGST on the invoice." label="State">
          <Select
            ariaLabel="State"
            onChange={(code) => set({ stateCode: code, stateName: GST_STATES.find((state) => state.code === code)?.name ?? "" })}
            options={STATE_OPTIONS}
            value={draft.stateCode}
          />
        </Field>
        {isAdmin ? (
          <Field label="Lead owner">
            <Select ariaLabel="Lead owner" onChange={(assignedToId) => set({ assignedToId })} options={ownerOptions} value={draft.assignedToId} />
          </Field>
        ) : null}
      </div>
    </FormModal>
  );
}
