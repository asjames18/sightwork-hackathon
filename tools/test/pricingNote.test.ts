/** Live-price counts on the cost range: parser, planning note, contract check. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pricingNote, stepChecksForPlan, MAX_CHECK_NOTE } from "@/lib/stepChecks";
import { checkWorkPlan, COST_LABEL, parsePricingCounts, type CostRange, type WorkPlan } from "@/lib/types";

const cost = (pricing?: unknown): CostRange =>
  ({ low: 250, high: 360, currency: "USD", label: COST_LABEL, region: "Atlanta, GA", laborBasis: "volunteer", assumptions: [], ...(pricing === undefined ? {} : { pricing }) }) as CostRange;

function plan(costRange: CostRange | null): WorkPlan {
  return {
    spaceName: "Stage",
    generatedFrom: "",
    inventory: [],
    issues: [{ rank: 1, title: "Cable", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 0, unmentioned: true }],
    materials: [],
    workOrder: [],
    afterImageUrl: null,
    transcript: null,
    frames: [{ index: 0, tSec: 0, url: "/f0.webp" }],
    costRange,
  };
}

test("parsePricingCounts accepts whole counts with grounded <= priced only", () => {
  assert.deepEqual(parsePricingCounts({ priced: 6, grounded: 4 }), { priced: 6, grounded: 4 });
  assert.deepEqual(parsePricingCounts({ priced: 0, grounded: 0 }), { priced: 0, grounded: 0 });
  for (const bad of [null, undefined, "6", { priced: 3, grounded: 4 }, { priced: 2.5, grounded: 1 }, { priced: 3, grounded: -1 }, { priced: "3", grounded: 1 }])
    assert.equal(parsePricingCounts(bad), null, JSON.stringify(bad));
});

test("pricingNote: only when the cost step reported counts and priced something", () => {
  assert.equal(pricingNote(plan(cost({ priced: 6, grounded: 4 }))), "4 of 6 prices looked up live");
  assert.equal(pricingNote(plan(cost({ priced: 1, grounded: 1 }))), "1 of 1 price looked up live");
  assert.equal(pricingNote(plan(cost({ priced: 0, grounded: 0 }))), null);
  assert.equal(pricingNote(plan(cost())), null);
  assert.equal(pricingNote(plan(null)), null);
});

test("planning step note appends the live-price count, and stays within the note limit", () => {
  assert.equal(stepChecksForPlan(plan(cost({ priced: 6, grounded: 4 }))).planning?.note, "Plan: 1 problem, each with a proof frame; 4 of 6 prices looked up live");
  assert.equal(stepChecksForPlan(plan(cost())).planning?.note, "Plan: 1 problem, each with a proof frame");
  const n = stepChecksForPlan(plan(cost({ priced: 6, grounded: 4 }))).planning!.note;
  assert.ok(n.length <= MAX_CHECK_NOTE);
});

test("contract check rejects bad price counts and accepts good or missing ones", () => {
  assert.deepEqual(checkWorkPlan(plan(cost({ priced: 6, grounded: 4 }))), []);
  assert.deepEqual(checkWorkPlan(plan(cost())), []);
  assert.ok(checkWorkPlan(plan(cost({ priced: 2, grounded: 5 }))).some((e) => e.includes("costRange.pricing")));
});
