# Super Admin Panel — Audit

**Date:** 2026-09-06
**Scope:** `backend/src/modules/superAdmin/*`, `backend/src/modules/onboarding/*`,
`backend/src/services/databaseDeletion.service.ts`, `backend/prisma/master/schema.prisma`,
`frontend/src/app/super-admin/*`, and the middleware those paths depend on.
**Method:** line-by-line read of every route, service and component in scope, cross-checked
against the master schema and the middleware chain in `backend/src/routes/index.ts`.

This audit describes the panel **as it stands after the billing work landed in this change**.
Findings introduced *by* that work are marked ⓝ so they are not confused with pre-existing debt.

---

## Severity legend

| Level | Meaning |
|---|---|
| **P0** | Can lose customer data, lose money, or lock a paying school out. Fix before more tenants onboard. |
| **P1** | Real bug or security weakness with a plausible path to harm. Fix this quarter. |
| **P2** | Correctness or robustness gap that will bite at scale. |
| **P3** | Polish, consistency, developer experience. |

---

## 1. Confirmed bugs

### 1.1 — No super-admin action is written to any audit log · **P0**
`backend/src/routes/index.ts:34-36`

```
apiRouter.use("/super-admin", superAdminRouter);   // ← mounted first
apiRouter.use("/tenant-setup", tenantSetupRouter);
apiRouter.use(auditMutatingRequest);               // ← audit starts here
```

The audit middleware is registered **after** the super-admin router, so every super-admin
mutation bypasses it: password resets, role changes, user creation, deactivation, school
deletion. The most privileged actor in the system is the only one with no trail.

A principal cannot see that their password was changed, and there is no way to answer
"who reset this account and when" after the fact. It is also the kind of gap that fails a
customer security review.

> Billing actions added in this change *do* write `billing_events` rows — but they are the
> only super-admin actions that do.

**Fix:** move `apiRouter.use(auditMutatingRequest)` above the super-admin mount, or add a
dedicated `super_admin_events` table in the master DB written by every mutating route.

---

### 1.2 — Immediate, irreversible school deletion with a one-click confirm · **P0**
`backend/src/modules/superAdmin/superAdmin.service.ts:439`,
`frontend/src/app/super-admin/page.tsx` (`handleDeleteSchool`)

`DELETE /super-admin/schools/:schoolId` marks the tenant `DELETED` and drops the Neon
database **in the same request**. The only guard is a browser `window.confirm`.

The school-initiated path (`databaseDeletion.service.ts:10`) is far more careful — a
`DELETION_DELAY_MS` of 3 days, a cancel window, and password re-verification. The super
admin path, which is the more dangerous one, has none of that.

Compounding it:
- No export or backup is taken first. The data is simply gone.
- The Neon drop is best-effort (`if (!response.ok) logger.warn(...)`). A failed drop leaves
  the record reading `DELETED` while the database still exists and still bills. Nothing
  reconciles this later, and `TenantDeletionStatus.FAILED` is rendered in the UI but has no
  retry action behind it.

**Fix:** require typing the school name to confirm; route super-admin deletion through the
same 3-day scheduler; take a `pg_dump` to object storage before the drop; add a
reconciliation job that re-attempts failed drops and surfaces them in the panel.

---

### 1.3 — The last principal can be demoted or deactivated · **P1**
`superAdmin.service.ts:214` (`updateTenantUserStatus`), `:310` (`updateTenantUserRole`)

Neither function counts remaining active principals. The super admin can deactivate — or
role-change away — the only `PRINCIPAL` in a school, leaving the tenant with nobody who can
administer it. Since billing is now `PRINCIPAL`-only
(`backend/src/modules/billing/billing.routes.ts`), that also leaves nobody who can pay the
invoice, turning an accident into a churn event.

The role `<select>` in the UI fires on `onChange` with no confirmation step, so this is one
mis-click away.

**Fix:** reject the change when it would leave zero active principals; add a confirm step to
the role dropdown.

---

### 1.4 — `dismissPasswordResetRequest` does not check the request is pending · **P2**
`superAdmin.service.ts:289`

`completePasswordResetRequest` guards correctly:

```ts
if (request.status !== PasswordResetStatus.PENDING) throw new AppError(409, ...);
```

`dismissPasswordResetRequest` has no such guard and no existence check. Dismissing an
already-completed request silently overwrites `completedAt` / `completedBy`, destroying the
record of who actually handled it, and dismissing a non-existent id throws a raw Prisma
error instead of a 404.

**Fix:** mirror the guard from `completePasswordResetRequest`.

---

### 1.5 — Rate-limit buckets are never evicted · **P2**
`backend/src/middleware/rateLimit.ts:9-18`

`const buckets = new Map<string, Bucket>()` only ever grows. Expired entries are overwritten
when the *same* key returns, but a key that never returns is retained forever. One entry per
`(keyPrefix, IP)` pair for the life of the process is a slow leak on a long-running dyno.

Separately, the store is per-process and in-memory: with more than one instance the real
limit is `max × instanceCount`, and it resets on every deploy. For the super-admin login
route (`max: 10`) that materially weakens the brute-force protection it exists to provide.

**Fix:** sweep expired buckets on a timer, and back the limiter with the Redis client the
project already depends on (`ioredis` is in `package.json`, `REDIS_URL` is in the env schema).

---

### 1.6 — Logout does not invalidate the access token · **P2**
`superAdmin.routes.ts` (`/logout`), `lib/superAdminCookie.ts`

Logout clears the `ss_sa` cookie only. The bearer JWT stays valid for its full 8 hours; there
is no blocklist or token version. A token captured before logout keeps working. For an
account that can delete any tenant, "log out" should mean something.

**Fix:** keep a `tokenVersion` (or a jti denylist) in the master DB and check it in
`requireSuperAdmin`.

---

### 1.7 — Super-admin tokens are signed with the tenant-user secret · **P2**
`superAdmin.service.ts:21`, `superAdmin.middleware.ts:20`

Both super-admin and ordinary user tokens are signed with `env.JWT_ACCESS_SECRET`. They are
distinguished only by a `kind: "SUPER_ADMIN"` claim checked inside `requireSuperAdmin`.

Today this is safe by luck: `requireAuth` rejects a super-admin token because it carries no
`tenantSchoolId`. But any future route that verifies with `JWT_ACCESS_SECRET` and forgets the
`kind` check inherits full platform privilege. Two audiences sharing one signing key is a
foot-gun waiting for a tired afternoon.

**Fix:** a separate `SUPER_ADMIN_JWT_SECRET`.

---

### 1.8 — Plaintext password fallback and non-constant-time compare · **P2**
`superAdmin.service.ts:75` (`loginSuperAdmin`)

```ts
const valid = env.SUPER_ADMIN_PASSWORD_HASH
  ? await bcrypt.compare(password, env.SUPER_ADMIN_PASSWORD_HASH)
  : password === env.SUPER_ADMIN_PASSWORD;
```

`SUPER_ADMIN_PASSWORD` is accepted as a plaintext env var, and the fallback compare is a
`===` on secret material — a (weak, but real) timing oracle. The hash path should be the only
path in production.

**Fix:** require `SUPER_ADMIN_PASSWORD_HASH` when `NODE_ENV === "production"`; use
`crypto.timingSafeEqual` if the plaintext path is kept for local dev.

---

### 1.9 — Unhandled errors leak internal messages to the client · **P2**
`backend/src/middleware/errorHandler.ts:69-73`

The 500 branch returns `error.message` verbatim. Prisma errors in particular embed table
names, column names and query fragments. This affects the whole API, not just the panel, but
the panel is where the most sensitive queries run.

**Fix:** return a fixed string in production and log the detail server-side.

---

### 1.10 — Duplicate phone/email on user creation gives an unusable message · **P3**
`superAdmin.service.ts:344` (`createTenantUser`)

The tenant `User` model has `@@unique([schoolId, email])` and `@@unique([schoolId, phone])`
(`backend/prisma/schema.prisma:99-100`). `createTenantUser` performs no pre-check, so a
duplicate surfaces through the generic P2002 handler as **"Duplicate record"** with no
indication of *which* field collided.

Also in the same function: `tenantPrisma.school.findFirst({ select: { id: true } })` picks a
school row with no ordering. Correct for one-school-per-database, but it will silently pick
the wrong parent the day that assumption breaks.

---

### 1.11 — Creating or promoting a principal silently rewrites master-DB contact details · **P3**
`superAdmin.service.ts:310`, `:344`

Both functions write `ownerName` / `email` / `phone` onto the master `School` row whenever the
affected user is a `PRINCIPAL`. Add a second principal and the school's billing contact is
overwritten with no warning and no way to tell which principal is authoritative. The `.catch()`
swallows failures, so the two databases can also silently disagree.

---

## 2. Minus points (design and robustness)

### 2.1 — Everything loads unpaginated
- `listSchoolsForSuperAdmin` (`:120`) fetches **every** school, every render. Filtering is
  client-side in `useMemo`.
- `listSchoolUsers` (`:160`) fetches **every** user in a school with no `take`.
- `listPasswordResetRequests` caps at 100 with no cursor — request 101 is invisible.

Fine at 20 tenants. At 500 tenants × 60 staff it is a slow page and a large payload on every
refresh.

### 2.2 — A single 830-line client component
`frontend/src/app/super-admin/page.tsx` held login, session bootstrap, schools, users,
password resets and all their handlers in one file. This change extracted `superAdminFetch`
and added `BillingPanel` as a sibling, but the schools/users half is untouched and still
monolithic. There are no tests of any kind against it.

### 2.3 — Native browser primitives instead of the design system
The panel uses raw `<select>` (project convention is the shared `CustomSelect`),
`window.confirm` and `window.prompt` rather than the `Modal` component, and hand-rolled
Tailwind rather than `Button` / `DataTable` / `StatusPill`. It reads like a different product
from the rest of the app. *(The new `BillingPanel` follows the existing panel's local
conventions to stay internally consistent — it inherits this debt rather than adding to it.)*

### 2.4 — Password handling in the reset workflow
The super admin types a new password into a plain field and reads it off the screen. There is
no generator, no strength check, no copy button, and — most importantly — **no delivery
mechanism**. The password has to be relayed out-of-band, by hand, over WhatsApp or a phone
call. And nothing in the flow verifies that the person who raised the request is who they
claim to be; the UI's "for verified users" is aspirational.

### 2.5 — No feedback discipline
`error` and `notice` are single strings that never auto-dismiss, are not `aria-live`, and are
overwritten by the next action. Long operations show no progress. The table forces horizontal
scrolling below ~900px with no responsive fallback.

### 2.6 — The panel is on a guessable public path
`/super-admin` is served by the same Next app as the tenant UI, with no IP allowlist, no MFA,
and no second factor of any kind protecting a single shared credential that can delete every
customer database.

### 2.7 — Onboarding logs are written and never read
`OnboardingLog` rows are created at `STARTED`, `PENDING_APPROVAL`, `DATABASE_DELETED` and
`FAILED` — and there is no screen anywhere that displays them. When an onboarding fails, the
only way to see why is a direct database query.

### 2.8 — Schools awaiting approval are buried
A brand-new school appears in the same list as everything else, distinguished only by an
"Awaiting approval" pill. There is no queue, no count badge, no ordering by wait time, and no
notification. A signup can sit unapproved for days without anyone noticing.

---

## 3. Missing features

### 3.1 — Must implement

| Feature | Why it is a *must* |
|---|---|
| **Super-admin action audit log** | See 1.1. Non-negotiable for a multi-tenant product handling children's data. |
| **Deletion safeguards** (typed confirm, delay, backup, failed-drop reconciliation) | See 1.2. One mis-click currently destroys a customer. |
| **Transactional email / WhatsApp** | Nothing is sent to schools today — not approval, not expiry warnings, not invoices, not receipts, not password resets. Billing is only half-real without it: a school's access can lapse with no warning it ever received. |
| **Multiple super-admin accounts with roles** | One shared credential means no accountability, no offboarding, and no separation between support (read + reset passwords) and finance (refunds). |
| **MFA on the super-admin login** | Single factor guarding total platform access. |
| **Plan limit enforcement** ⓝ | `maxStudents` / `maxStaff` and the `features` JSON are stored, priced and displayed, but nothing blocks a school from exceeding them. Limits that are not enforced are marketing copy, not a plan. |
| **Invoice PDF** ⓝ | Indian schools need a GST invoice document for their books. The data model has everything required; only the renderer is missing (`pdfkit` is already a dependency). |

### 3.2 — Should implement

| Feature | Value |
|---|---|
| **Support impersonation** ("view as principal", time-boxed and audited) | Today the only way to debug a tenant issue is to reset someone's password and log in as them — which is exactly the anti-pattern 1.1 makes untraceable. |
| **Onboarding queue** with counts, wait time and one-click approve | See 2.8. |
| **Onboarding log viewer** | See 2.7. |
| **Per-tenant health card**: DB size, last login, active users, storage used, error rate | Needed to spot a dying account before it churns, and to size Neon costs per tenant. |
| **Platform analytics**: signups over time, activation funnel, churn, cohort retention | There is no way to answer "how is the business doing" from inside the product. |
| **Server-side search + pagination** | See 2.1. |
| **CSV export** of schools, subscriptions and invoices | Finance will ask for this in month one. |
| **Bulk actions** (extend N trials, message all past-due schools) | |
| **Announcement / broadcast banner to all tenants** | For maintenance windows and pricing changes. |
| **Tenant migration status view** | `scripts/migrate-tenants.mjs` exists; there is no way to see which tenant databases are behind without running it. |
| **Dunning schedule** ⓝ | Invoices go `DUE` and then silently past due. A real dunning ladder (day 0 / 3 / 7 / 14 reminders, then suspension) is what actually collects money. |
| **Proration on mid-term upgrades** ⓝ | Upgrading today charges a full new term and restarts the clock. Fine for launch; wrong once schools move between tiers mid-year. |

### 3.3 — Nice to have

- Saved filter views and column sorting on the schools list.
- Dark mode (the rest of the app supports it; the panel does not).
- Keyboard shortcuts for the queue workflow.
- Webhook delivery log viewer — `webhook_events` rows are stored ⓝ but only readable via SQL.
- Per-tenant feature flag overrides on top of the plan's `features` map ⓝ.
- Revenue forecasting from `currentPeriodEnd` across active subscriptions.

---

## 4. Prioritised backlog

| # | Item | Severity | Est. |
|---|---|---|---|
| 1 | Super-admin audit log (§1.1) | P0 | M |
| 2 | Deletion safeguards + failed-drop reconciliation (§1.2) | P0 | M |
| 3 | Last-principal guard (§1.3) | P1 | S |
| 4 | Transactional email/WhatsApp for billing + approval (§3.1) | P1 | L |
| 5 | MFA + multiple super-admin accounts (§3.1) | P1 | L |
| 6 | Separate super-admin JWT secret (§1.7) + token invalidation on logout (§1.6) | P2 | S |
| 7 | Redis-backed rate limiting with eviction (§1.5) | P2 | S |
| 8 | Plan limit + feature-flag enforcement (§3.1) | P2 | M |
| 9 | Server-side pagination and search (§2.1) | P2 | M |
| 10 | Invoice PDF (§3.1) | P2 | S |
| 11 | Onboarding queue + log viewer (§2.7, §2.8) | P2 | M |
| 12 | Dismiss-request guard (§1.4), duplicate-user message (§1.10), error leak (§1.9) | P2/P3 | S |
| 13 | Design-system pass on the panel (§2.3, §2.5) | P3 | M |

---

## 5. Notes on what this change already fixed

Recorded here so the backlog above is not double-counted.

- **A lapsed school could never pay.** `resolveTenant` returned 402 for the entire tenant API
  the moment `isActive` went false, so the principal could not even sign in to renew. The
  tenant middleware now allows `/auth`, `/billing` and `/health` through for a suspended
  tenant, and the frontend redirects a principal on 402 to `/subscription`.
- **Two workers fought over `School.isActive`.** `trial.service.ts` suspended any school past
  `trialEndsAt` while the new subscription worker manages grace periods. That file has been
  removed; `runSubscriptionMaintenance` is now the single writer.
- **The price was hardcoded.** `BASE_PRICE = 20_000` in `coupon.service.ts` is now read from
  the super-admin-editable plan catalogue.
- **Coupons had no admin UI at all.** The `Coupon` table existed and was read during
  onboarding, but nothing in the panel could create, edit, disable or delete one. Coupons now
  have full CRUD plus redemption limits and a redemption counter.
- **Grant / revoke / extend had no audit or price context.** They now go through the
  subscription and write `billing_events` rows.
