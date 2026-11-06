import assert from "node:assert/strict";
import { chooseUpgradePlan, isQuotedPlan, priceUpgrade } from "../src/modules/billing/billing.pricing.js";

/**
 * The 2026 price list is tiered by student count, and outgrowing a tier is what
 * triggers an upgrade. This checks the tier chosen for a given roll and what
 * moving to it costs — the difference between the two plans, mid-term — without
 * touching a database.
 *
 *   npm run test:plan-tiers
 */

type AnyPlan = Parameters<typeof priceUpgrade>[1];

function plan(code: string, name: string, priceRupees: number, maxStudents: number | null, sortOrder: number, features: Record<string, boolean> = {}) {
  return {
    id: code,
    code,
    name,
    description: null,
    priceMinor: priceRupees * 100,
    currency: "INR",
    interval: "YEAR",
    intervalCount: 1,
    trialDays: 0,
    maxStudents,
    maxStaff: null,
    features,
    isActive: true,
    isPublic: true,
    sortOrder,
    createdAt: new Date(),
    updatedAt: new Date()
  } as unknown as AnyPlan;
}

const TRIAL = plan("TRIAL", "30-day Trial", 0, 500, 0);
const STARTER = plan("STARTER", "Starter", 9_999, 300, 10);
const GROWTH = plan("GROWTH", "Growth", 14_999, 700, 20);
const PREMIUM = plan("PREMIUM", "Premium", 24_999, 1_500, 30);
const ENTERPRISE = plan("ENTERPRISE", "Enterprise", 39_999, null, 40, { customPricing: true });
const CATALOGUE = [TRIAL, STARTER, GROWTH, PREMIUM, ENTERPRISE];

// --- the published price list -----------------------------------------------

assert.equal(STARTER.priceMinor, 999_900, "Starter is ₹9,999 a year for 300 students");
assert.equal(GROWTH.priceMinor, 1_499_900, "Growth is ₹14,999 a year for 700 students");
assert.equal(PREMIUM.priceMinor, 2_499_900, "Premium is ₹24,999 a year for 1,500 students");
assert.equal(isQuotedPlan(ENTERPRISE), true, "above Premium the price is quoted, not listed");
assert.equal(isQuotedPlan(PREMIUM), false);

// --- which tier a roll needs --------------------------------------------------

assert.equal(chooseUpgradePlan(CATALOGUE, 301, STARTER.priceMinor)?.code, "GROWTH", "301 students outgrows Starter");
assert.equal(chooseUpgradePlan(CATALOGUE, 700, STARTER.priceMinor)?.code, "GROWTH", "Growth covers exactly 700");
assert.equal(chooseUpgradePlan(CATALOGUE, 701, STARTER.priceMinor)?.code, "PREMIUM", "701 skips Growth entirely");
assert.equal(chooseUpgradePlan(CATALOGUE, 1_501, PREMIUM.priceMinor)?.code, "ENTERPRISE", "past 1,500 it is Enterprise");
assert.equal(
  chooseUpgradePlan(CATALOGUE, 301, PREMIUM.priceMinor)?.code,
  "ENTERPRISE",
  "a cheaper tier is never offered as an upgrade, even when it would fit the roll"
);
assert.equal(
  chooseUpgradePlan([TRIAL, STARTER], 400, STARTER.priceMinor),
  null,
  "nothing is offered when no bigger tier is on sale"
);
assert.equal(
  chooseUpgradePlan([...CATALOGUE, plan("LEGACY", "Legacy", 20_000, null, 1)], 301, STARTER.priceMinor)?.code,
  "GROWTH",
  "a dearer uncapped plan sorted to the front does not displace the tier that fits"
);
assert.equal(
  chooseUpgradePlan(
    [...CATALOGUE, { ...plan("RETIRED", "Retired", 11_000, 700, 15), isActive: false } as typeof GROWTH],
    301,
    STARTER.priceMinor
  )?.code,
  "GROWTH",
  "a retired plan is never offered, however cheap"
);

// --- what the upgrade costs --------------------------------------------------

const periodStart = new Date("2026-04-01T00:00:00.000Z");
const periodEnd = new Date("2027-04-01T00:00:00.000Z");
const today = new Date("2026-11-07T00:00:00.000Z");

const paid = {
  status: "ACTIVE",
  currentPeriodStart: periodStart,
  currentPeriodEnd: periodEnd,
  customPriceMinor: null,
  plan: STARTER
};

const starterToGrowth = priceUpgrade(paid, GROWTH, today);
assert.equal(starterToGrowth.subtotalMinor, 500_000, "₹14,999 − ₹9,999 = ₹5,000");
assert.equal(starterToGrowth.taxMinor, 90_000, "18% GST on the difference");
assert.equal(starterToGrowth.totalMinor, 590_000);
assert.equal(starterToGrowth.chargesDifferenceOnly, true);
assert.equal(starterToGrowth.periodEnd.toISOString(), periodEnd.toISOString(), "the renewal date does not move");
assert.equal(starterToGrowth.selfServe, true);

const starterToPremium = priceUpgrade(paid, PREMIUM, today);
assert.equal(starterToPremium.subtotalMinor, 1_500_000, "₹24,999 − ₹9,999 = ₹15,000");

const growthToPremium = priceUpgrade({ ...paid, plan: GROWTH }, PREMIUM, today);
assert.equal(growthToPremium.subtotalMinor, 1_000_000, "₹24,999 − ₹14,999 = ₹10,000");

// Enterprise is quoted, so there is nothing to buy online.
const toEnterprise = priceUpgrade({ ...paid, plan: PREMIUM }, ENTERPRISE, today);
assert.equal(toEnterprise.selfServe, false);
assert.ok(toEnterprise.note?.includes("quote"), "the prompt says it is priced on quote");

// A trial has nothing to top up, so an upgrade is the plan's full price and a
// fresh twelve months — not ₹14,999 for whatever is left of the trial.
const fromTrial = priceUpgrade(
  { status: "TRIALING", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, customPriceMinor: null, plan: TRIAL },
  GROWTH,
  today
);
assert.equal(fromTrial.chargesDifferenceOnly, false);
assert.equal(fromTrial.subtotalMinor, 1_499_900, "a trial pays the full price");
assert.equal(fromTrial.periodEnd.toISOString(), new Date("2027-11-07T00:00:00.000Z").toISOString(), "and gets a full year");

// So does a term that has already lapsed.
const lapsed = priceUpgrade({ ...paid, status: "PAST_DUE" }, GROWTH, today);
assert.equal(lapsed.chargesDifferenceOnly, false);
assert.equal(lapsed.subtotalMinor, 1_499_900);

// A negotiated rate was agreed with sales, so the gap against it is not ours to
// charge automatically.
const negotiated = priceUpgrade({ ...paid, customPriceMinor: 700_000 }, GROWTH, today);
assert.equal(negotiated.selfServe, false);
assert.equal(negotiated.subtotalMinor, 799_900, "₹14,999 − the ₹7,000 agreed rate");

console.log("✓ plan tier pricing and upgrade quotes");
