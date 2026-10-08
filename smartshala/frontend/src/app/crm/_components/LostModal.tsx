"use client";

import { useState } from "react";
import { Field, FormModal, TextArea } from "../../super-admin/_components/ui";

/** Asks why before a deal is marked a missed sale — from the deal page or a drop on the board. */
export function LostModal({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormModal
      danger
      description="It counts towards missed sales. You can reopen it later."
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
      open
      submitDisabled={!reason.trim()}
      submitLabel="Mark as missed sale"
      submitting={busy}
      title="Mark this deal as a missed sale"
    >
      <Field label="Why was the sale missed?">
        <TextArea autoFocus onChange={(event) => setReason(event.target.value)} placeholder="Chose another vendor, budget, not reachable…" value={reason} />
      </Field>
    </FormModal>
  );
}
