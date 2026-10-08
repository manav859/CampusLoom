"use client";

import { useState } from "react";
import { Field, FormModal, TextArea } from "../../super-admin/_components/ui";

/** Asks why before a deal is marked lost — from the deal page or a drop on the board. */
export function LostModal({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormModal
      danger
      description="It counts towards lost revenue. You can reopen it later."
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
      open
      submitDisabled={!reason.trim()}
      submitLabel="Mark lost"
      submitting={busy}
      title="Mark this deal lost"
    >
      <Field label="Why was it lost?">
        <TextArea autoFocus onChange={(event) => setReason(event.target.value)} placeholder="Chose another vendor, budget, not reachable…" value={reason} />
      </Field>
    </FormModal>
  );
}
