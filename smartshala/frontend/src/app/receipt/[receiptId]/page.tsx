"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { env } from "@/lib/env";
import { tenantApiBase } from "@/lib/tenant";

export default function PublicReceiptPage() {
  const params = useParams<{ receiptId: string }>();
  const pdfUrl = useMemo(
    () => `${tenantApiBase(env.apiBaseUrl)}/fees/public/receipts/${params.receiptId}/pdf`,
    [params.receiptId]
  );

  return (
    <main className="flex min-h-screen flex-col bg-[#F7F8FB]">
      <div className="flex items-center justify-between border-b border-[#DCE1E8] bg-white px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">SmartShala</p>
          <h1 className="text-[18px] font-bold text-[#0F1419]">Fee receipt</h1>
        </div>
        <a className="btn-primary min-h-10 px-5 text-[13px]" href={pdfUrl}>
          Download PDF
        </a>
      </div>
      <iframe className="min-h-0 flex-1" src={pdfUrl} title="Fee receipt PDF" />
    </main>
  );
}
