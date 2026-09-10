"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useResource } from "../_lib/resource";
import type { Summary } from "../_lib/types";
import { SchoolBillingDrawer } from "../_components/SchoolBillingDrawer";
import { Badge, PageHeader, Tabs } from "../_components/ui";
import { CouponsTab } from "./_tabs/CouponsTab";
import { InvoicesTab } from "./_tabs/InvoicesTab";
import { OverviewTab } from "./_tabs/OverviewTab";
import { PaymentLinksTab } from "./_tabs/PaymentLinksTab";
import { PlansTab } from "./_tabs/PlansTab";
import { SubscriptionsTab } from "./_tabs/SubscriptionsTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "invoices", label: "Invoices" },
  { id: "links", label: "Payment links" },
  { id: "plans", label: "Plans" },
  { id: "coupons", label: "Coupons" }
] as const;

export type BillingTab = (typeof TABS)[number]["id"];

export default function SuperAdminBillingPage() {
  // useSearchParams needs a Suspense boundary to prerender this page.
  return (
    <Suspense fallback={null}>
      <BillingPortal />
    </Suspense>
  );
}

function BillingPortal() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const summary = useResource<Summary>("/billing/summary");

  // The tab and the open school live in the URL, so a view can be linked to
  // and the back button behaves.
  const requested = params.get("tab");
  const tab: BillingTab = TABS.some((item) => item.id === requested) ? (requested as BillingTab) : "overview";
  const openSchoolId = params.get("school");

  function navigate(next: { tab?: BillingTab; school?: string | null }) {
    const query = new URLSearchParams(params.toString());
    if (next.tab) query.set("tab", next.tab);
    if (next.school === null) query.delete("school");
    else if (next.school) query.set("school", next.school);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  const openSchool = (schoolId: string) => navigate({ school: schoolId });
  const mode = summary.data?.gateway.mode;

  return (
    <>
      <PageHeader
        actions={
          mode ? (
            <Badge tone={mode === "LIVE" ? "good" : "warn"}>{mode === "LIVE" ? "Razorpay live — real payments" : "Test mode — no real money"}</Badge>
          ) : null
        }
        description="Plans, invoices and payments for every school."
        title="Billing"
      />

      <Tabs
        active={tab}
        onChange={(id) => navigate({ tab: id, school: null })}
        tabs={TABS.map((item) => ({
          ...item,
          count: item.id === "invoices" ? summary.data?.outstandingInvoiceCount : undefined
        }))}
      />

      {tab === "overview" ? <OverviewTab onNavigate={(id) => navigate({ tab: id })} /> : null}
      {tab === "subscriptions" ? <SubscriptionsTab onOpenSchool={openSchool} /> : null}
      {tab === "invoices" ? <InvoicesTab onOpenSchool={openSchool} /> : null}
      {tab === "links" ? <PaymentLinksTab onOpenSchool={openSchool} /> : null}
      {tab === "plans" ? <PlansTab /> : null}
      {tab === "coupons" ? <CouponsTab /> : null}

      {openSchoolId ? <SchoolBillingDrawer onClose={() => navigate({ school: null })} schoolId={openSchoolId} /> : null}
    </>
  );
}
