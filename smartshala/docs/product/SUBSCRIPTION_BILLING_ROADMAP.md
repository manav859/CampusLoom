# Subscription & Billing — What's Left

**Date:** 2026-09-07 · **Updated:** 2026-09-07
**Status of the shipped work:** live on `main` as of `8c9b2c4`; Phases 1 and 2 plus SA6
built on top.
**Purpose:** the working list we pick items off one at a time.

> **Shipped since this list was written:** all of Phase 1 — `B1`–`B4`, `SA1`–`SA5`, `P1`,
> `E3` — plus `SA6` (per-school negotiated pricing), `SA9` (usage visible to the super
> admin), `M1` (payment reconciliation, which `B3` forced forward: writing off a stale
> order without asking the gateway would have buried real payments), and `M2` + `M3`
> (invoice PDF and billing notifications), which closed `P2` along the way. Completed
> items are marked ✅ below.

Every item has an ID (`B1`, `SA3`, …) so we can say "do SA4 next" without ambiguity.
Sizes are S (under an hour), M (half a day), L (a day or more).

---

## Where it stands today

Working end to end, verified by `npm run test:billing`:

- Plan catalogue with full super-admin CRUD; price, interval, trial days, limits, feature map.
- Coupons with percentage/flat discounts, expiry and redemption caps.
- One subscription per school, with `TRIALING → ACTIVE → PAST_DUE → EXPIRED` and `CANCELLED`.
- Checkout: order → mock gateway → HMAC-SHA256 signature → capture → invoice paid → term extended.
- Webhook endpoint with signature verification and replay protection.
- Invoice and payment records, offline settlement, void, refund.
- Grace period and expiry handled by `runSubscriptionMaintenance`.
- Principal page at `/subscription`; super admin Billing tab with revenue KPIs.

So the **happy path works**. What follows is what stands between that and a system you
can actually run a business on.

---

## 1. Bugs — fix these first

These are defects in what already shipped, not new features. All are small.

| ID | Issue | Size |
|---|---|---|
| **B1** ✅ | **A full refund leaves the school with paid access.** `refundPayment` updates the payment and the invoice but never touches the subscription (`billingAdmin.service.ts`, no `tx.subscription` call in the transaction). Refund a year's fee and the school keeps the year. Refunding should reverse the term it bought, or at minimum drop the subscription to `PAST_DUE` and let the super admin decide. | S |
| **B2** ✅ | **Coupon redemptions never decrement.** `redeemedCount` increments on capture (`billing.service.ts:415`) and is never reduced on refund or void. A coupon capped at 50 uses is silently burned by failed and refunded orders. | S |
| **B3** ✅ | **Abandoned checkouts accumulate forever.** Every click of "Pay now" inserts a new `Payment` row in `CREATED`. Nothing ever expires them, so an invoice can carry a dozen dead orders and the payments table grows without bound. | S |
| **B4** ✅ | **No idempotency key on `POST /billing/checkout`.** A double-click creates two gateway orders against the same invoice. Harmless today because only one can capture, but it makes the payment log hard to read. | S |

---

## 2. Super admin control — your stated priority

The super admin currently has *most* control. Here is precisely what is missing.

### 2a. Built but not wired up — cheapest wins in the whole document

The backend endpoint exists and works; the panel simply never calls it.

| ID | Gap | Size |
|---|---|---|
| **SA1** ✅ | **Cannot change subscription status.** `PATCH /billing/schools/:schoolId/status` exists and `setSubscriptionStatus` is fully implemented — the UI never calls it. So the super admin cannot cancel a subscription, reinstate a cancelled one, or force a school past due. Add three buttons. | S |
| **SA2** ✅ | **No global invoice ledger.** `GET /billing/invoices` (with status and school filters) exists and is unused. Finance has no single screen showing every invoice across all schools. | S |
| **SA3** ✅ | **Partial refunds are API-only.** `refundPayment` accepts `amountRupees`; the panel always refunds the full amount. Add an amount field to the prompt. | S |
| **SA4** ✅ | **Manual invoices ignore coupons.** `createManualInvoice` accepts `couponCode`; the "Raise invoice" button never passes one, so a negotiated discount can't be applied to an invoice the super admin raises. | S |
| **SA5** ✅ | `GET /billing/public-plans` is dead code — nothing calls it. Delete it or use it. | S |

### 2b. Genuinely missing control

| ID | Gap | Why it matters | Size |
|---|---|---|---|
| **SA6** ✅ | **No per-school custom pricing.** Price lives only on the plan, so every school on `STANDARD` pays the same. School sales does not work this way — every deal is negotiated. Needs either a price override on `Subscription` or private per-school plans (`isPublic: false` already exists for this). | **L** |
| **SA7** | **Cannot toggle auto-renew for a school.** Only the principal can. Support gets "turn my auto-renew off" calls and cannot act on them. | S |
| **SA8** | **Cannot edit an invoice once raised.** No changing the amount, due date, line items or notes. The only options are void and re-raise. | M |
| **SA9** ✅ | **Super admin cannot see a school's usage.** The principal sees students/staff against plan limits; the super admin — who decides upgrades — sees nothing. Requires reading counts from the tenant DB per school. | M |
| **SA10** | **Billing event log is capped at the last 25 on Overview.** No filtering by school, action or date, and no pagination. `billing_events` is the audit trail for money; it needs a real viewer. | M |
| **SA11** | **No webhook delivery viewer.** `webhook_events` rows are written with payload, signature validity and error, and are readable only by SQL. When a payment "doesn't go through", this is the first place you look. | M |
| **SA12** | **No revenue reporting.** Overview shows point-in-time MRR/ARR/collected/outstanding. There is no MRR movement (new/expansion/churn), no collection rate, no invoice ageing, no cohort retention. | L |
| **SA13** | **No CSV export** of invoices, payments or subscriptions. Finance will ask in week one. | S |
| **SA14** | **No bulk actions** — extend every trial by N days, raise renewal invoices for a cohort, message all past-due schools. | M |
| **SA15** | **Actions are not attributable.** `BillingEvent.actor` is always `SUPER_ADMIN:super-admin` because there is one shared login. Ties directly to the panel audit's finding on multiple admin accounts. | L |

---

## 3. Completing the money workflow

| ID | Gap | Detail | Size |
|---|---|---|---|
| **M1** ✅ | **No payment reconciliation** | If the webhook fails *and* the browser closes before `/checkout/confirm`, the invoice stays `DUE` forever while the money has actually left the school's account. `razorpay.fetchOrder()` was built for exactly this and **is never called anywhere**. Needs a sweep that reconciles every `CREATED` payment older than ~15 minutes against the gateway. This is the single largest hole in the money path. | **M** |
| **M2** ✅ | **No invoice document** | Built as `invoice-pdf.ts`, alongside the fee receipt it borrows its look from. Downloadable by the principal (own invoices only) and by the super admin from both the ledger and the school drawer. Long payment histories flow onto a second page. Seller identity comes from `BILLING_SELLER_NAME` / `BILLING_SELLER_ADDRESS` / `BILLING_SUPPORT_EMAIL` — still not a GST tax invoice until `G1`–`G4` land. | M |
| **M3** ✅ | **No notifications, at all** | `billing.notifications.ts` sends on invoice raised, renewal due, payment received, payment failed, past due, grace ending and suspension, over WhatsApp via the existing provider. Every message is recorded in `billing_notifications` (visible in the super admin school drawer) and deduped per school + type + subject, so the hourly sweep cannot repeat itself. A messaging failure can never fail a billing action. No email — there is no mailer in the codebase yet. | **L** |
| **M4** | **No dunning ladder** | Invoices go `DUE` and then quietly past due. Collections need a schedule — day 0 / 3 / 7 / 14 reminders, then suspension — and a record of what was sent. Depends on M3. | M |
| **M5** | **No proration** | Upgrading mid-term charges a full new term and restarts the clock. A school upgrading in month 2 of 12 forfeits 10 months it already paid for. Needs credit for unused time. | M |
| **M6** | **No credit notes** | A refund mutates the original invoice's `amountPaidMinor` in place. Accounting (and GST) require the original invoice to stay immutable and a separate credit note to be issued against it. | M |
| **M7** | **No autopay / mandate** | Every renewal is a manual card entry. Razorpay Subscriptions or UPI eMandate would make renewal automatic — the single biggest lever on collection rate. | L |
| **M8** | **No payment method storage** | Nothing is remembered between terms, so each renewal starts cold. | M |

---

## 4. The plan doesn't actually mean anything yet

Everything here is stored, priced and displayed — and enforced nowhere.

| ID | Gap | Size |
|---|---|---|
| **E1** | **`maxStudents` / `maxStaff` are display-only.** Confirmed: no reference to either outside the billing module. A school on a 500-student plan can add 5,000. Limits that aren't enforced are marketing copy. | M |
| **E2** | **The `features` map is not enforced.** The trial plan declares `whatsapp: false`, `analytics: false`, `chatbot: false` — all three work fine on trial. | M |
| **E3** ✅ | **No downgrade guard.** Nothing stops moving a 900-student school onto a 500-student plan. | S |
| **E4** | **Past-due schools look completely normal to staff.** Only the principal sees the state, on a page they have to visit. No banner, no degradation, no warning as the grace window closes. | M |

---

## 5. Principal experience

| ID | Gap | Size |
|---|---|---|
| **P1** ✅ | **No invoice detail view.** `GET /billing/invoices/:invoiceId` and `billingApi.invoice()` both exist and are called from nowhere. The history table is a dead end — no drill-down, no receipt. | S |
| **P2** ✅ | **No invoice download.** Came with M2: the invoice detail modal has a Download button. | S |
| **P3** | **Billing is `PRINCIPAL`-only.** The accountant — the person who actually handles money in an Indian school — cannot see an invoice. Worth a read-only role. | S |
| **P4** | **No billing contact.** Invoices and reminders would go to the principal's personal number. Schools want them going to the accounts desk. | S |
| **P5** | **Nothing explains what happens at expiry** — is data kept, for how long, what is lost. This is the question every school asks before paying. | S |

---

## 6. GST compliance — needed before charging real money in India

Today's invoice is not a tax invoice. It has a single flat `BILLING_TAX_PERCENT` and none of
the identifiers the law requires, so schools cannot claim input credit and the invoices will
not survive an audit.

| ID | Gap | Size |
|---|---|---|
| **G1** | **No billing identity on `School`** — no GSTIN, no PAN, no state code, no billing address separate from the school address, no billing email. The master `School` model has only `email`, `phone`, `address`. | M |
| **G2** | **No CGST/SGST vs IGST split.** Tax is one number. Intra-state supply must split into CGST + SGST; inter-state is IGST. Requires the state code from G1. | M |
| **G3** | **No place of supply, no HSN/SAC code** (998314 for SaaS), and no seller GSTIN on the document. | S |
| **G4** | **Invoice numbering is a single global sequence.** GST expects a per-financial-year series that resets in April. `INV-2026-000001` derives its year from `new Date()`, not the financial year. | S |

---

## 7. Suggestions worth considering

Not gaps — ideas that would make the product materially better.

- **S1 — Annual prepay discount.** Two months free on yearly is the standard SaaS lever and the schema already supports it (`interval` + `intervalCount`).
- **S2 — Per-student pricing tier.** Schools intuitively price per child. A `pricePerStudentMinor` alongside the flat price would let sales quote either way.
- **S3 — Referral coupons.** School principals talk to each other constantly; the coupon system is already there to hang this on.
- **S4 — Self-serve plan comparison before signup.** The onboarding form asks for TRIAL/STANDARD with no pricing page behind it.
- **S5 — Trial-expiry nudges inside the product**, not just email — a countdown in the topbar for the last 7 days.
- **S6 — A "what changed" note on the subscription page** so the principal can see term extensions and plan changes the super admin made on their behalf.
- **S7 — Sandbox/demo tenant excluded from revenue metrics**, so MRR isn't polluted by test schools.
- **S8 — Dispute/chargeback handling.** Razorpay sends `payment.dispute.*` webhooks; nothing handles them today.

---

## Suggested build order

Sequenced so each phase is independently shippable and earlier phases unblock later ones.

### Phase 1 — Close the bugs and wire up what exists — DONE
`B1` `B2` `B3` `B4` · `SA1` `SA2` `SA3` `SA4` `SA5` · `P1` `E3`

All small, all low-risk. Ends with the super admin having complete control over
subscription state, invoices and refunds, and the principal able to open an invoice.
**Best place to start** — it is mostly connecting endpoints that already work.

### Phase 2 — Make the money path trustworthy — DONE
`M1` (reconciliation — the important one) · `M2` (invoice PDF) · `P2`

No payment can be silently lost, and every school can produce a document.

### Phase 3 — Super admin depth *(SA6 + SA9 done)*
`SA6` (custom pricing) · `SA7` `SA8` `SA9` `SA10` `SA11` `SA13`

This is the phase that most directly answers "the super admin should have all access and
control". SA6 is the big one and worth designing before building.

### Phase 4 — Enforcement *(1–2 days)*
`E1` `E2` `E4`

Turns the plan from a price tag into an actual product boundary.

### Phase 5 — Communications and collections *(M3 done; M4 + S5 remain)*
`M3` (notifications) · `M4` (dunning) · `S5`

M3 gave every money event a message and a delivery record. `M4` now has somewhere to
hang the day 0 / 3 / 7 / 14 ladder: add the reminder types and a scheduled sweep on top
of `billing_notifications`.

### Phase 6 — Compliance *(1–2 days)*
`G1` `G2` `G3` `G4` · `M6` (credit notes)

**Must land before real money is charged**, so pull it forward the moment
`RAZORPAY_MODE=live` is on the table.

### Phase 7 — Automation and reporting
`M5` (proration) · `M7` (autopay) · `M8` · `SA12` `SA14` `SA15`

---

## The one dependency that outranks everything here

Going live with real payments needs, in this order: **G1–G4** (legal invoices),
**M1** ✅ (no lost payments), **M2** ✅ (a document to send), **M3** ✅ (the school knows
what it owes). **G1–G4 are now the only thing left on that list**, so they are what
stands between today and `RAZORPAY_MODE=live`.

Related: [SUPER_ADMIN_AUDIT.md](./SUPER_ADMIN_AUDIT.md) — the panel-wide audit. Its two P0s
(no super-admin audit trail, unguarded school deletion) sit outside billing but affect the
same screens.
