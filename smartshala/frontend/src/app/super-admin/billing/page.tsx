"use client";

import { useState } from "react";
import { BillingPanel } from "../BillingPanel";

export default function SuperAdminBillingPage() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  return (
    <div className="space-y-5">
      <header className="border-b border-[#dce3ef] pb-5">
        <h1 className="text-2xl font-semibold tracking-normal">Billing</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Plans, coupons, subscriptions, invoices and the payment links you send to schools.
        </p>
      </header>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{notice}</p> : null}

      <BillingPanel onError={setError} onNotice={setNotice} />
    </div>
  );
}
