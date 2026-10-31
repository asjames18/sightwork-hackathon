/** The live-price sentence: same words on the cost card, in the shared text and in the PDF. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { livePricesLine, planToText } from "@/lib/client/planText";
import { COST_LABEL, type WorkPlan } from "@/lib/types";

const COST = { low: 120, high: 340, currency: "USD" as const, label: COST_LABEL, region: "Sebring, FL", laborBasis: "volunteer" as const, assumptions: [] };

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Stage",
    generatedFrom: "Walkthrough video, 8 frames, 30 s",
    inventory: [],
    issues: [{ rank: 1, title: "Cable across the steps", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 2, unmentioned: true }],
    materials: [{ item: "Cable cover", qty: "2" }],
    workOrder: [{ order: 1, title: "Cover the cable", detail: "" }],
    afterImageUrl: null,
    ...extra,
  } as WorkPlan;
}

test("all, some, none and single-price wording", () => {
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 3, grounded: 3 } }), "All 3 material prices looked up live on the web for Sebring, FL.");
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 6, grounded: 4 } }), "4 of 6 material prices looked up live on the web for Sebring, FL; the rest are regional estimates.");
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 5, grounded: 0 } }), "No live prices found, so the 5 material prices are regional estimates for Sebring, FL.");
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 1, grounded: 1 } }), "The 1 material price was looked up live on the web for Sebring, FL.");
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 1, grounded: 0 } }), "No live prices found, so the material price is a regional estimate for Sebring, FL.");
});

test("no line for example or older plans, zero priced, bad counts, or no cost range", () => {
  assert.equal(livePricesLine(COST), null);
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 0, grounded: 0 } }), null);
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 2, grounded: 3 } }), null);
  assert.equal(livePricesLine({ ...COST, pricing: { priced: 2.5, grounded: 1 } }), null);
  assert.equal(livePricesLine(null), null);
  assert.equal(livePricesLine(undefined), null);
});

test("blank region drops the place, never says 'for '", () => {
  assert.equal(livePricesLine({ ...COST, region: "  ", pricing: { priced: 2, grounded: 2 } }), "All 2 material prices looked up live on the web.");
});

test("shared text carries the line right under the cost, and only when counts exist", () => {
  const t = planToText(plan({ costRange: { ...COST, pricing: { priced: 6, grounded: 4 } } }));
  assert.match(t, /\nCost: \$120-\$340 for Sebring, FL\. [^\n]+\n4 of 6 material prices looked up live on the web for Sebring, FL; the rest are regional estimates\.\n/);
  assert.doesNotMatch(planToText(plan({ costRange: COST })), /looked up live/);
});
