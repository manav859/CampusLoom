"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMinor, type Invoice, type Plan, type SubscriptionStatus } from "@/lib/api";
import { superAdminDownload, superAdminFetch } from "./superAdminFetch";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  isActive: boolean;
  expiresAt: string | null;
};

type SubscriptionRow = {
  id: string;
  schoolId: string;
  status: SubscriptionStatus;
  customPriceMinor: number | null;
  customPriceNote: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
  school: { schoolId: string; schoolName: string; ownerName: string; email: string; phone: string; isActive: boolean };
};

type Summary = {
  statusCounts: Partial<Record<SubscriptionStatus, number>>;
  mrrMinor: number;
  arrMinor: number;
  lifetimeCollectedMinor: number;
  collectedThisMonthMinor: number;
  outstandingMinor: number;
  outstandingInvoiceCount: number;
  expiringSoon: number;
  recentEvents: { id: string; schoolId: string | null; actor: string; action: string; message: string; createdAt: string }[];
  gateway: { mode: "MOCK" | "LIVE" };
};

type SchoolBilling = {
  school: { schoolId: string; schoolName: string; ownerName: string; email: string; isActive: boolean };
  subscription: SubscriptionRow & { plan: Plan };
  pricing: {
    listPriceMinor: number;
    effectivePriceMinor: number;
    isCustomPrice: boolean;
    customPriceNote: string | null;
  };
  usage: {
    students: number | null;
    staff: number | null;
    reachable: boolean;
    maxStudents: number | null;
    maxStaff: number | null;
  };
  invoices: Invoice[];
  events: { id: string; actor: string; action: string; message: string; createdAt: string }[];
  notifications: BillingNotification[];
};

type BillingNotification = {
  id: string;
  type: string;
  recipient: string;
  message: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  sentAt: string | null;
  createdAt: string;
};

type LedgerInvoice = Invoice & { school: { schoolName: string } };

type PlanRow = Plan & { subscriberCount: number };

const TABS = ["Overview", "Plans", "Coupons", "Subscriptions", "Invoices"] as const;
type Tab = (typeof TABS)[number];

const card = "rounded-2xl border border-[#dce3ef] bg-white p-4 shadow-sm";
const input = "min-h-10 w-full rounded-lg border border-[#dce3ef] px-3 text-sm outline-none focus:border-[#2456e6]";
const primaryBtn = "min-h-10 rounded-lg bg-[#2456e6] px-4 text-xs font-bold text-white disabled:opacity-60";
const ghostBtn = "min-h-9 rounded-lg border border-[#cbd5e1] bg-white px-3 text-xs font-bold disabled:opacity-60";

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  TRIALING: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAST_DUE: "bg-amber-50 text-amber-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-red-50 text-red-700"
};

function fmtDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
}

const EMPTY_PLAN = {
  code: "",
  name: "",
  description: "",
  priceRupees: 0,
  interval: "YEAR" as "MONTH" | "YEAR",
  intervalCount: 1,
  trialDays: 0,
  maxStudents: "",
  maxStaff: "",
  isActive: true,
  isPublic: true,
  sortOrder: 0
};

const EMPTY_COUPON = {
  code: "",
  description: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
  discountValue: 10,
  maxRedemptions: "",
  isActive: true,
  expiresAt: ""
};

export function BillingPanel({ onError, onNotice }: { onError: (message: string) => void; onNotice: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [detail, setDetail] = useState<SchoolBilling | null>(null);
  const [ledger, setLedger] = useState<LedgerInvoice[]>([]);
  const [ledgerStatus, setLedgerStatus] = useState<"" | Invoice["status"]>("DUE");
  const [priceDraft, setPriceDraft] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SubscriptionStatus>("");

  const [planDraft, setPlanDraft] = useState({ ...EMPTY_PLAN });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [couponDraft, setCouponDraft] = useState({ ...EMPTY_COUPON });

  const run = useCallback(
    async (key: string, action: () => Promise<void>, successMessage?: string) => {
      setBusy(key);
      try {
        await action();
        if (successMessage) onNotice(successMessage);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setBusy("");
      }
    },
    [onError, onNotice]
  );

  const loadSummary = useCallback(async () => setSummary(await superAdminFetch<Summary>("/billing/summary")), []);
  const loadPlans = useCallback(async () => setPlans(await superAdminFetch<PlanRow[]>("/billing/plans")), []);
  const loadCoupons = useCallback(async () => setCoupons(await superAdminFetch<Coupon[]>("/billing/coupons")), []);
  const loadSubscriptions = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (query.trim()) params.set("query", query.trim());
    setSubscriptions(await superAdminFetch<SubscriptionRow[]>(`/billing/subscriptions?${params.toString()}`));
  }, [query, statusFilter]);

  const loadLedger = useCallback(async () => {
    const params = new URLSearchParams();
    if (ledgerStatus) params.set("status", ledgerStatus);
    setLedger(await superAdminFetch<LedgerInvoice[]>(`/billing/invoices?${params.toString()}`));
  }, [ledgerStatus]);

  useEffect(() => {
    void run("load", async () => {
      if (tab === "Overview") await loadSummary();
      if (tab === "Plans") await loadPlans();
      if (tab === "Coupons") await loadCoupons();
      if (tab === "Subscriptions") await loadSubscriptions();
      if (tab === "Invoices") await loadLedger();
    });
  }, [tab, loadSummary, loadPlans, loadCoupons, loadSubscriptions, loadLedger, run]);

  const outstandingLabel = useMemo(
    () => (summary ? `${summary.outstandingInvoiceCount} invoice${summary.outstandingInvoiceCount === 1 ? "" : "s"}` : ""),
    [summary]
  );

  // --- plans -----------------------------------------------------------------

  function editPlan(plan: PlanRow) {
    setEditingPlanId(plan.id);
    setPlanDraft({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      priceRupees: plan.priceMinor / 100,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      trialDays: plan.trialDays,
      maxStudents: plan.maxStudents === null ? "" : String(plan.maxStudents),
      maxStaff: plan.maxStaff === null ? "" : String(plan.maxStaff),
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder
    });
  }

  function planBody() {
    return {
      name: planDraft.name.trim(),
      description: planDraft.description.trim() || null,
      priceRupees: Number(planDraft.priceRupees),
      interval: planDraft.interval,
      intervalCount: Number(planDraft.intervalCount),
      trialDays: Number(planDraft.trialDays),
      maxStudents: planDraft.maxStudents === "" ? null : Number(planDraft.maxStudents),
      maxStaff: planDraft.maxStaff === "" ? null : Number(planDraft.maxStaff),
      isActive: planDraft.isActive,
      isPublic: planDraft.isPublic,
      sortOrder: Number(planDraft.sortOrder)
    };
  }

  function savePlan() {
    void run(
      "save-plan",
      async () => {
        if (editingPlanId) {
          await superAdminFetch(`/billing/plans/${editingPlanId}`, { method: "PATCH", body: JSON.stringify(planBody()) });
        } else {
          await superAdminFetch("/billing/plans", {
            method: "POST",
            body: JSON.stringify({ code: planDraft.code.trim().toUpperCase(), ...planBody() })
          });
        }
        setPlanDraft({ ...EMPTY_PLAN });
        setEditingPlanId(null);
        await loadPlans();
      },
      editingPlanId ? "Plan updated." : "Plan created."
    );
  }

  function removePlan(plan: PlanRow) {
    if (!window.confirm(`Archive or delete plan ${plan.code}? Plans with subscribers are archived, not deleted.`)) return;
    void run(
      `plan-${plan.id}`,
      async () => {
        await superAdminFetch(`/billing/plans/${plan.id}`, { method: "DELETE" });
        await loadPlans();
      },
      `Plan ${plan.code} removed.`
    );
  }

  // --- coupons ---------------------------------------------------------------

  function createCoupon() {
    void run(
      "save-coupon",
      async () => {
        await superAdminFetch("/billing/coupons", {
          method: "POST",
          body: JSON.stringify({
            code: couponDraft.code.trim().toUpperCase(),
            description: couponDraft.description.trim() || null,
            discountType: couponDraft.discountType,
            discountValue: Number(couponDraft.discountValue),
            maxRedemptions: couponDraft.maxRedemptions === "" ? null : Number(couponDraft.maxRedemptions),
            isActive: couponDraft.isActive,
            expiresAt: couponDraft.expiresAt ? new Date(couponDraft.expiresAt).toISOString() : null
          })
        });
        setCouponDraft({ ...EMPTY_COUPON });
        await loadCoupons();
      },
      "Coupon created."
    );
  }

  function toggleCoupon(coupon: Coupon) {
    void run(`coupon-${coupon.id}`, async () => {
      await superAdminFetch(`/billing/coupons/${coupon.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      await loadCoupons();
    });
  }

  function removeCoupon(coupon: Coupon) {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
    void run(`coupon-${coupon.id}`, async () => {
      await superAdminFetch(`/billing/coupons/${coupon.id}`, { method: "DELETE" });
      await loadCoupons();
    });
  }

  // --- school drilldown -------------------------------------------------------

  function openSchool(schoolId: string) {
    void run(`school-${schoolId}`, async () => {
      // The plan list drives the change-plan selector, so make sure it is loaded
      // even when the super admin came straight to the Subscriptions tab.
      const [billing] = await Promise.all([
        superAdminFetch<SchoolBilling>(`/billing/schools/${schoolId}`),
        plans.length ? Promise.resolve() : loadPlans()
      ]);
      setDetail(billing);
      setPriceDraft(billing.subscription.customPriceMinor === null ? "" : String(billing.subscription.customPriceMinor / 100));
      setPriceNote(billing.subscription.customPriceNote ?? "");
    });
  }

  function saveCustomPrice(schoolId: string) {
    const trimmed = priceDraft.trim();
    void run(
      `price-${schoolId}`,
      async () => {
        await superAdminFetch(`/billing/schools/${schoolId}/price`, {
          method: "PATCH",
          body: JSON.stringify({
            priceRupees: trimmed === "" ? null : Number(trimmed),
            note: priceNote.trim() || null
          })
        });
        await refreshDetail();
      },
      trimmed === "" ? "Back to plan list price." : `Custom price set to ₹${Number(trimmed).toLocaleString("en-IN")}.`
    );
  }

  function setStatus(schoolId: string, status: SubscriptionStatus) {
    const reason = window.prompt(`Why are you moving this subscription to ${status}?`) ?? "";
    void run(
      `status-${schoolId}`,
      async () => {
        await superAdminFetch(`/billing/schools/${schoolId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status, reason: reason || undefined })
        });
        await refreshDetail();
      },
      `Subscription set to ${status}.`
    );
  }

  async function refreshDetail() {
    if (!detail) return;
    setDetail(await superAdminFetch<SchoolBilling>(`/billing/schools/${detail.school.schoolId}`));
    await loadSubscriptions();
  }

  function changePlan(schoolId: string, planCode: string) {
    void run(
      `change-${schoolId}`,
      async () => {
        await superAdminFetch(`/billing/schools/${schoolId}/plan`, {
          method: "PATCH",
          body: JSON.stringify({ planCode, restartPeriod: true, reason: "Changed from the super admin panel" })
        });
        await refreshDetail();
      },
      `Plan changed to ${planCode}.`
    );
  }

  function extend(schoolId: string, days: number) {
    void run(
      `extend-${schoolId}`,
      async () => {
        await superAdminFetch(`/billing/schools/${schoolId}/extend`, { method: "PATCH", body: JSON.stringify({ days }) });
        await refreshDetail();
      },
      `Access extended by ${days} days.`
    );
  }

  function raiseInvoice(schoolId: string, planCode: string) {
    const couponCode = window.prompt("Coupon code to apply (leave blank for none)") ?? "";
    void run(
      `invoice-${schoolId}`,
      async () => {
        await superAdminFetch(`/billing/schools/${schoolId}/invoices`, {
          method: "POST",
          body: JSON.stringify({ planCode, couponCode: couponCode.trim() || null })
        });
        await refreshDetail();
      },
      "Invoice raised."
    );
  }

  function downloadInvoice(invoice: Invoice) {
    void run(`pdf-${invoice.id}`, () =>
      superAdminDownload(`/billing/invoices/${invoice.id}/pdf`, `invoice-${invoice.number}.pdf`)
    );
  }

  function markPaid(invoice: Invoice) {
    const method = window.prompt("Settlement method (cash, cheque, neft, upi, card, other)", "neft");
    if (!method) return;
    const reference = window.prompt("Reference number (optional)") ?? "";
    void run(
      `paid-${invoice.id}`,
      async () => {
        await superAdminFetch(`/billing/invoices/${invoice.id}/mark-paid`, {
          method: "POST",
          body: JSON.stringify({ method: method.toLowerCase(), reference: reference || null })
        });
        await refreshDetail();
      },
      `Invoice ${invoice.number} marked paid.`
    );
  }

  function voidInvoice(invoice: Invoice) {
    const reason = window.prompt(`Why are you voiding ${invoice.number}?`);
    if (!reason) return;
    void run(
      `void-${invoice.id}`,
      async () => {
        await superAdminFetch(`/billing/invoices/${invoice.id}/void`, { method: "POST", body: JSON.stringify({ reason }) });
        await refreshDetail();
      },
      `Invoice ${invoice.number} voided.`
    );
  }

  function refund(paymentId: string, invoiceNumber: string, refundableMinor: number) {
    const reason = window.prompt(`Reason for refunding the payment on ${invoiceNumber}?`);
    if (!reason) return;
    const maxRupees = refundableMinor / 100;
    const entered = window.prompt(
      `Amount to refund in INR (blank refunds the full ₹${maxRupees.toLocaleString("en-IN")})`,
      String(maxRupees)
    );
    if (entered === null) return;
    const amountRupees = entered.trim() === "" ? undefined : Number(entered);
    if (amountRupees !== undefined && (!Number.isFinite(amountRupees) || amountRupees <= 0 || amountRupees > maxRupees)) {
      onError(`Refund must be between ₹1 and ₹${maxRupees.toLocaleString("en-IN")}`);
      return;
    }

    void run(
      `refund-${paymentId}`,
      async () => {
        await superAdminFetch(`/billing/payments/${paymentId}/refund`, {
          method: "POST",
          body: JSON.stringify({ reason, ...(amountRupees === undefined ? {} : { amountRupees }) })
        });
        await refreshDetail();
      },
      "Refund processed."
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#dce3ef] pb-3">
        {TABS.map((item) => (
          <button
            className={`min-h-9 rounded-lg px-4 text-sm font-bold transition ${
              tab === item ? "bg-[#2456e6] text-white" : "border border-[#cbd5e1] bg-white text-[#334155]"
            }`}
            key={item}
            onClick={() => {
              setTab(item);
              setDetail(null);
            }}
            type="button"
          >
            {item}
          </button>
        ))}
        {summary ? (
          <span
            className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
              summary.gateway.mode === "LIVE" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"
            }`}
          >
            Razorpay: {summary.gateway.mode}
          </span>
        ) : null}
      </div>

      {/* Overview ------------------------------------------------------------- */}
      {tab === "Overview" && summary ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "MRR", value: formatMinor(summary.mrrMinor), hint: `ARR ${formatMinor(summary.arrMinor)}` },
              { label: "Collected this month", value: formatMinor(summary.collectedThisMonthMinor), hint: `Lifetime ${formatMinor(summary.lifetimeCollectedMinor)}` },
              { label: "Outstanding", value: formatMinor(summary.outstandingMinor), hint: outstandingLabel },
              { label: "Expiring in 14 days", value: String(summary.expiringSoon), hint: "Active or trialing" }
            ].map((kpi) => (
              <div className={card} key={kpi.label}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">{kpi.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#111827]">{kpi.value}</p>
                <p className="mt-1 text-xs font-semibold text-[#64748b]">{kpi.hint}</p>
              </div>
            ))}
          </div>

          <div className={card}>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#64748b]">Subscriptions by status</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(STATUS_CLASS) as SubscriptionStatus[]).map((status) => (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLASS[status]}`} key={status}>
                  {status}: {summary.statusCounts[status] ?? 0}
                </span>
              ))}
            </div>
          </div>

          <div className={card}>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#64748b]">Recent billing activity</h3>
            <ul className="mt-3 divide-y divide-[#eef2f7]">
              {summary.recentEvents.map((event) => (
                <li className="py-2" key={event.id}>
                  <p className="text-sm font-semibold text-[#111827]">{event.message}</p>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    {event.action} · {event.actor} · {event.schoolId ?? "platform"} ·{" "}
                    {new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </li>
              ))}
              {summary.recentEvents.length === 0 ? <li className="py-2 text-sm text-[#64748b]">Nothing yet.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Plans ---------------------------------------------------------------- */}
      {tab === "Plans" ? (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="text-lg font-semibold">{editingPlanId ? "Edit plan" : "New plan"}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block text-xs font-bold text-[#334155]">
                Code
                <input
                  className={`${input} mt-1 uppercase`}
                  disabled={Boolean(editingPlanId)}
                  onChange={(e) => setPlanDraft({ ...planDraft, code: e.target.value })}
                  placeholder="GROWTH"
                  value={planDraft.code}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Name
                <input className={`${input} mt-1`} onChange={(e) => setPlanDraft({ ...planDraft, name: e.target.value })} value={planDraft.name} />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Price (INR, ex-GST)
                <input
                  className={`${input} mt-1`}
                  min={0}
                  onChange={(e) => setPlanDraft({ ...planDraft, priceRupees: Number(e.target.value) })}
                  type="number"
                  value={planDraft.priceRupees}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Billing interval
                <select
                  className={`${input} mt-1 bg-white`}
                  onChange={(e) => setPlanDraft({ ...planDraft, interval: e.target.value as "MONTH" | "YEAR" })}
                  value={planDraft.interval}
                >
                  <option value="MONTH">Monthly</option>
                  <option value="YEAR">Yearly</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Trial days
                <input
                  className={`${input} mt-1`}
                  min={0}
                  onChange={(e) => setPlanDraft({ ...planDraft, trialDays: Number(e.target.value) })}
                  type="number"
                  value={planDraft.trialDays}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Max students (blank = unlimited)
                <input
                  className={`${input} mt-1`}
                  onChange={(e) => setPlanDraft({ ...planDraft, maxStudents: e.target.value })}
                  type="number"
                  value={planDraft.maxStudents}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Max staff (blank = unlimited)
                <input
                  className={`${input} mt-1`}
                  onChange={(e) => setPlanDraft({ ...planDraft, maxStaff: e.target.value })}
                  type="number"
                  value={planDraft.maxStaff}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Sort order
                <input
                  className={`${input} mt-1`}
                  onChange={(e) => setPlanDraft({ ...planDraft, sortOrder: Number(e.target.value) })}
                  type="number"
                  value={planDraft.sortOrder}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155] sm:col-span-2 xl:col-span-4">
                Description
                <input
                  className={`${input} mt-1`}
                  onChange={(e) => setPlanDraft({ ...planDraft, description: e.target.value })}
                  value={planDraft.description}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-[#334155]">
                <input checked={planDraft.isActive} onChange={(e) => setPlanDraft({ ...planDraft, isActive: e.target.checked })} type="checkbox" />
                Active
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-[#334155]">
                <input checked={planDraft.isPublic} onChange={(e) => setPlanDraft({ ...planDraft, isPublic: e.target.checked })} type="checkbox" />
                Offered to schools
              </label>
              <button className={primaryBtn} disabled={busy === "save-plan"} onClick={savePlan} type="button">
                {busy === "save-plan" ? "Saving..." : editingPlanId ? "Save changes" : "Create plan"}
              </button>
              {editingPlanId ? (
                <button
                  className={ghostBtn}
                  onClick={() => {
                    setEditingPlanId(null);
                    setPlanDraft({ ...EMPTY_PLAN });
                  }}
                  type="button"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#dce3ef] bg-white shadow-sm">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="table-head text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Limits</th>
                  <th className="px-4 py-3">Schools</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr className="border-t border-[#eef2f7]" key={plan.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-xs text-[#64748b]">{plan.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      {formatMinor(plan.priceMinor, plan.currency)}
                      <span className="text-xs text-[#64748b]"> / {plan.intervalCount > 1 ? plan.intervalCount : ""}{plan.interval.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748b]">
                      {plan.maxStudents ?? "∞"} students · {plan.maxStaff ?? "∞"} staff
                      {plan.trialDays ? ` · ${plan.trialDays}d trial` : ""}
                    </td>
                    <td className="px-4 py-3 font-semibold">{plan.subscriberCount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${plan.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {plan.isActive ? (plan.isPublic ? "Public" : "Internal") : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className={ghostBtn} onClick={() => editPlan(plan)} type="button">
                          Edit
                        </button>
                        <button
                          className="min-h-9 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-60"
                          disabled={busy === `plan-${plan.id}`}
                          onClick={() => removePlan(plan)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Coupons -------------------------------------------------------------- */}
      {tab === "Coupons" ? (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="text-lg font-semibold">New coupon</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="block text-xs font-bold text-[#334155]">
                Code
                <input
                  className={`${input} mt-1 uppercase`}
                  onChange={(e) => setCouponDraft({ ...couponDraft, code: e.target.value })}
                  placeholder="LAUNCH25"
                  value={couponDraft.code}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Type
                <select
                  className={`${input} mt-1 bg-white`}
                  onChange={(e) => setCouponDraft({ ...couponDraft, discountType: e.target.value as "PERCENTAGE" | "FIXED" })}
                  value={couponDraft.discountType}
                >
                  <option value="PERCENTAGE">Percentage off</option>
                  <option value="FIXED">Flat INR off</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Value
                <input
                  className={`${input} mt-1`}
                  min={0}
                  onChange={(e) => setCouponDraft({ ...couponDraft, discountValue: Number(e.target.value) })}
                  type="number"
                  value={couponDraft.discountValue}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Max redemptions (blank = unlimited)
                <input
                  className={`${input} mt-1`}
                  onChange={(e) => setCouponDraft({ ...couponDraft, maxRedemptions: e.target.value })}
                  type="number"
                  value={couponDraft.maxRedemptions}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Expires
                <input
                  className={`${input} mt-1`}
                  onChange={(e) => setCouponDraft({ ...couponDraft, expiresAt: e.target.value })}
                  type="date"
                  value={couponDraft.expiresAt}
                />
              </label>
              <label className="block text-xs font-bold text-[#334155]">
                Description
                <input
                  className={`${input} mt-1`}
                  onChange={(e) => setCouponDraft({ ...couponDraft, description: e.target.value })}
                  value={couponDraft.description}
                />
              </label>
            </div>
            <button className={`${primaryBtn} mt-4`} disabled={busy === "save-coupon"} onClick={createCoupon} type="button">
              {busy === "save-coupon" ? "Creating..." : "Create coupon"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#dce3ef] bg-white shadow-sm">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead className="table-head text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Redemptions</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr className="border-t border-[#eef2f7]" key={coupon.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{coupon.code}</p>
                      {coupon.description ? <p className="text-xs text-[#64748b]">{coupon.description}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      {coupon.discountType === "PERCENTAGE" ? `${Number(coupon.discountValue)}%` : formatMinor(Number(coupon.discountValue) * 100)}
                    </td>
                    <td className="px-4 py-3">
                      {coupon.redeemedCount}
                      {coupon.maxRedemptions === null ? "" : ` / ${coupon.maxRedemptions}`}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{fmtDate(coupon.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${coupon.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {coupon.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className={ghostBtn} disabled={busy === `coupon-${coupon.id}`} onClick={() => toggleCoupon(coupon)} type="button">
                          {coupon.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="min-h-9 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-60"
                          disabled={busy === `coupon-${coupon.id}`}
                          onClick={() => removeCoupon(coupon)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-[#64748b]" colSpan={6}>
                      No coupons yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Subscriptions --------------------------------------------------------- */}
      {tab === "Subscriptions" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className={`${input} max-w-xs`}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run("load", loadSubscriptions);
              }}
              placeholder="Search school, id or email"
              value={query}
            />
            <select className={`${input} max-w-[200px] bg-white`} onChange={(e) => setStatusFilter(e.target.value as "" | SubscriptionStatus)} value={statusFilter}>
              <option value="">All statuses</option>
              {(Object.keys(STATUS_CLASS) as SubscriptionStatus[]).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button className={primaryBtn} onClick={() => void run("load", loadSubscriptions)} type="button">
              Apply
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#dce3ef] bg-white shadow-sm">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="table-head text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Term ends</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((row) => (
                  <tr className="border-t border-[#eef2f7]" key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.school.schoolName}</p>
                      <p className="text-xs text-[#64748b]">
                        {row.schoolId} · {row.school.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.plan.name}</p>
                      <p className="text-xs text-[#64748b]">{formatMinor(row.plan.priceMinor, row.plan.currency)} / {row.plan.interval.toLowerCase()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_CLASS[row.status]}`}>{row.status}</span>
                      {row.cancelAtPeriodEnd ? <p className="mt-1 text-xs font-semibold text-amber-800">Auto-renew off</p> : null}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{fmtDate(row.currentPeriodEnd)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className={ghostBtn} disabled={busy === `school-${row.schoolId}`} onClick={() => openSchool(row.schoolId)} type="button">
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-[#64748b]" colSpan={5}>
                      No subscriptions match that filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {detail ? (
            <div className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef2f7] pb-4">
                <div>
                  <h3 className="text-xl font-semibold">{detail.school.schoolName}</h3>
                  <p className="mt-1 text-sm text-[#64748b]">
                    {detail.school.schoolId} · {detail.school.ownerName} · {detail.school.email}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className={`rounded-full px-3 py-1 ${STATUS_CLASS[detail.subscription.status]}`}>{detail.subscription.status}</span>
                    <span className="rounded-full bg-[#f1f5f9] px-3 py-1">{detail.subscription.plan.name}</span>
                    <span className="rounded-full bg-[#f1f5f9] px-3 py-1">Ends {fmtDate(detail.subscription.currentPeriodEnd)}</span>
                  </div>
                </div>
                <button className={ghostBtn} onClick={() => setDetail(null)} type="button">
                  Close
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="block text-xs font-bold text-[#334155]">
                  Move to plan
                  <select
                    className={`${input} mt-1 max-w-[220px] bg-white`}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) changePlan(detail.school.schoolId, e.target.value);
                    }}
                  >
                    <option disabled value="">
                      Select a plan
                    </option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.code}>
                        {plan.name} ({plan.code})
                      </option>
                    ))}
                  </select>
                </label>
                <button className={ghostBtn} disabled={busy.startsWith("extend")} onClick={() => extend(detail.school.schoolId, 30)} type="button">
                  Extend 30 days
                </button>
                <button
                  className={ghostBtn}
                  disabled={busy.startsWith("invoice")}
                  onClick={() => raiseInvoice(detail.school.schoolId, detail.subscription.plan.code)}
                  type="button"
                >
                  Raise invoice
                </button>
                <label className="block text-xs font-bold text-[#334155]">
                  Set status
                  <select
                    className={`${input} mt-1 max-w-[180px] bg-white`}
                    disabled={busy.startsWith("status")}
                    onChange={(e) => {
                      if (e.target.value) setStatus(detail.school.schoolId, e.target.value as SubscriptionStatus);
                      e.target.value = "";
                    }}
                    value=""
                  >
                    <option disabled value="">
                      Choose
                    </option>
                    {(Object.keys(STATUS_CLASS) as SubscriptionStatus[])
                      .filter((status) => status !== detail.subscription.status)
                      .map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {/* Pricing: list price by default, negotiated rate when set. */}
              <div className="mt-5 grid gap-4 rounded-xl border border-[#dce3ef] bg-[#f8fafc] p-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">Pricing</p>
                  <p className="mt-2 text-lg font-semibold text-[#111827]">
                    {formatMinor(detail.pricing.effectivePriceMinor, detail.subscription.plan.currency)}
                    <span className="ml-1 text-xs font-semibold text-[#64748b]">
                      per {detail.subscription.plan.interval.toLowerCase()}
                    </span>
                    {detail.pricing.isCustomPrice ? (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">Custom</span>
                    ) : (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">List price</span>
                    )}
                  </p>
                  {detail.pricing.isCustomPrice ? (
                    <p className="mt-1 text-xs text-[#64748b]">
                      Plan list price is {formatMinor(detail.pricing.listPriceMinor, detail.subscription.plan.currency)}
                      {detail.pricing.customPriceNote ? ` · ${detail.pricing.customPriceNote}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[#64748b]">This school is billed at the plan&apos;s list price.</p>
                  )}
                  <p className="mt-2 text-xs text-[#64748b]">
                    Applies to invoices raised from now on. Invoices already issued keep the amount they were issued at.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block text-xs font-bold text-[#334155]">
                    Custom price (INR, ex-GST)
                    <input
                      className={`${input} mt-1 max-w-[180px]`}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      placeholder="Blank = list price"
                      type="number"
                      value={priceDraft}
                    />
                  </label>
                  <label className="block text-xs font-bold text-[#334155]">
                    Note
                    <input
                      className={`${input} mt-1 max-w-[220px]`}
                      onChange={(e) => setPriceNote(e.target.value)}
                      placeholder="e.g. 3-year deal"
                      value={priceNote}
                    />
                  </label>
                  <button
                    className={primaryBtn}
                    disabled={busy === `price-${detail.school.schoolId}`}
                    onClick={() => saveCustomPrice(detail.school.schoolId)}
                    type="button"
                  >
                    {priceDraft.trim() === "" ? "Use list price" : "Save price"}
                  </button>
                </div>
              </div>

              {/* Usage, so upgrade decisions are made against real numbers. */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {detail.usage.reachable ? (
                  <>
                    <span className="text-[#334155]">
                      <span className="font-semibold">{detail.usage.students?.toLocaleString("en-IN")}</span> students
                      <span className="text-[#64748b]"> / {detail.usage.maxStudents?.toLocaleString("en-IN") ?? "unlimited"}</span>
                    </span>
                    <span className="text-[#334155]">
                      <span className="font-semibold">{detail.usage.staff?.toLocaleString("en-IN")}</span> staff
                      <span className="text-[#64748b]"> / {detail.usage.maxStaff?.toLocaleString("en-IN") ?? "unlimited"}</span>
                    </span>
                  </>
                ) : (
                  <span className="text-[#64748b]">Usage unavailable — the school database could not be reached.</span>
                )}
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead className="table-head text-left text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.invoices.map((invoice) => {
                      const captured = invoice.payments.find((payment) => payment.status === "CAPTURED");
                      return (
                        <tr className="border-t border-[#eef2f7]" key={invoice.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{invoice.number}</p>
                            <p className="text-xs text-[#64748b]">{invoice.planName}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#64748b]">
                            {fmtDate(invoice.periodStart)} — {fmtDate(invoice.periodEnd)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-xs font-bold">{invoice.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{formatMinor(invoice.totalMinor, invoice.currency)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button className={ghostBtn} disabled={busy === `pdf-${invoice.id}`} onClick={() => downloadInvoice(invoice)} type="button">
                                PDF
                              </button>
                              {invoice.status === "DUE" ? (
                                <>
                                  <button className={ghostBtn} disabled={busy === `paid-${invoice.id}`} onClick={() => markPaid(invoice)} type="button">
                                    Mark paid
                                  </button>
                                  <button className={ghostBtn} disabled={busy === `void-${invoice.id}`} onClick={() => voidInvoice(invoice)} type="button">
                                    Void
                                  </button>
                                </>
                              ) : null}
                              {captured && captured.refundedMinor < captured.amountMinor ? (
                                <button
                                  className="min-h-9 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-60"
                                  disabled={busy === `refund-${captured.id}`}
                                  onClick={() => refund(captured.id, invoice.number, captured.amountMinor - captured.refundedMinor)}
                                  type="button"
                                >
                                  Refund
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {detail.invoices.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-sm text-[#64748b]" colSpan={5}>
                          No invoices for this school yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 border-t border-[#eef2f7] pt-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">Messages sent to this school</h4>
                {detail.notifications.length ? (
                  <ul className="mt-2 space-y-1">
                    {detail.notifications.slice(0, 12).map((notification) => (
                      <li className="text-xs text-[#64748b]" key={notification.id}>
                        <span className="font-semibold text-[#334155]">
                          {new Date(notification.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </span>{" "}
                        ·{" "}
                        <span
                          className={
                            notification.status === "SENT"
                              ? "font-bold text-green-700"
                              : notification.status === "FAILED"
                                ? "font-bold text-red-700"
                                : "font-bold text-amber-700"
                          }
                        >
                          {notification.status}
                        </span>{" "}
                        · {notification.type.replace(/_/g, " ").toLowerCase()} · {notification.recipient || "no number on file"}
                        {notification.error ? ` · ${notification.error}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[#64748b]">Nothing has been sent to this school yet.</p>
                )}
              </div>

              <div className="mt-5 border-t border-[#eef2f7] pt-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">Billing history</h4>
                <ul className="mt-2 space-y-1">
                  {detail.events.slice(0, 12).map((event) => (
                    <li className="text-xs text-[#64748b]" key={event.id}>
                      <span className="font-semibold text-[#334155]">{new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>{" "}
                      · {event.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Invoice ledger -------------------------------------------------------- */}
      {tab === "Invoices" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${input} max-w-[200px] bg-white`}
              onChange={(e) => setLedgerStatus(e.target.value as "" | Invoice["status"])}
              value={ledgerStatus}
            >
              <option value="">All statuses</option>
              {(["DUE", "PAID", "VOID", "REFUNDED", "DRAFT"] as Invoice["status"][]).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button className={primaryBtn} disabled={busy === "load"} onClick={() => void run("load", loadLedger)} type="button">
              Refresh
            </button>
            <span className="text-sm font-semibold text-[#64748b]">
              {ledger.length} invoice{ledger.length === 1 ? "" : "s"} ·{" "}
              {formatMinor(ledger.reduce((sum, invoice) => sum + invoice.totalMinor, 0))} total
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#dce3ef] bg-white shadow-sm">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="table-head text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Invoice PDF</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((invoice) => (
                  <tr className="border-t border-[#eef2f7]" key={invoice.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{invoice.number}</p>
                      <p className="text-xs text-[#64748b]">{invoice.planName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-left font-semibold text-[#2456e6] hover:underline"
                        onClick={() => {
                          setTab("Subscriptions");
                          openSchool(invoice.schoolId);
                        }}
                        type="button"
                      >
                        {invoice.school?.schoolName ?? invoice.schoolId}
                      </button>
                      <p className="text-xs text-[#64748b]">{invoice.schoolId}</p>
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{fmtDate(invoice.issuedAt)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-xs font-bold">{invoice.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#64748b]">
                      {formatMinor(invoice.amountPaidMinor, invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMinor(invoice.totalMinor, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className={ghostBtn} disabled={busy === `pdf-${invoice.id}`} onClick={() => downloadInvoice(invoice)} type="button">
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
                {ledger.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-[#64748b]" colSpan={7}>
                      No invoices match that filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
