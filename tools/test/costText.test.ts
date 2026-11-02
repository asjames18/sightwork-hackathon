/** The cost card as share text for whoever approves the spend (costText.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COST_LABEL, type CostRange, type WorkPlan } from "@/lib/types";
import { costShareTitle, costToText } from "@/lib/client/costText";
import { SHARE_SIGNOFF } from "@/lib/client/planText";

type P = Pick<WorkPlan, "costRange" | "issues" | "workOrder" | "spaceName">;
const cost = (extra: Record<string, unknown> = {}): CostRange =>
  ({ low: 1180.5, high: 2643.2, currency: "USD", label: COST_LABEL, region: "Sebring, FL", laborBasis: "mixed", assumptions: ["Mid-grade materials", "15% contingency on every line"], ...extra }) as CostRange;
const plan = (c: CostRange | null, steps = 4): P => ({
  spaceName: "  Hope City   sanctuary ",
  costRange: c,
  issues: [1, 2, 3, 4].map((rank) => ({ rank, title: `Problem ${rank}` })) as WorkPlan["issues"],
  workOrder: Array.from({ length: steps }, (_, i) => ({ order: i + 1, title: `Step title ${i + 1}` })) as WorkPlan["workOrder"],
});
const byStep = [
  { order: 1, low: 480.3, high: 1120.8 },
  { order: 2, low: 520.1, high: 1120.3 },
  { order: 3, low: 60, high: 140 },
  { order: 4, low: 120.1, high: 262.1 },
];

test("no cost range, no text", () => {
  assert.equal(costToText(plan(null)), null);
});

test("range, region, label, labor and assumptions, then the quote reminder and sign-off", () => {
  assert.deepEqual(costToText(plan(cost()))?.split("\n"), [
    "Cost range · Hope City sanctuary",
    "$1,181–$2,643 for Sebring, FL",
    "Rough estimate, not a quote. Labor: volunteer and contractor.",
    "Assumes:",
    "- Mid-grade materials",
    "- 15% contingency on every line",
    "Get quotes before you commit to the spend.",
    "",
    SHARE_SIGNOFF,
  ]);
  assert.equal(costShareTitle(" Hope City  sanctuary"), "Cost range: Hope City sanctuary");
  assert.equal(costShareTitle(), "Cost range");
});

test("biggest steps first, the rest summed, shares that add up to the shown total", () => {
  const lines = costToText(plan(cost({ byStep })))!.split("\n");
  const i = lines.indexOf("Biggest steps:");
  assert.ok(i > 0);
  const rows = lines.slice(i + 1, i + 5);
  assert.match(rows[0], /^- Step 1, Step title 1: \$\d/);
  assert.match(rows[1], /^- Step 2, Step title 2: /);
  assert.match(rows[2], /^- Step 4, Step title 4: /);
  assert.match(rows[3], /^- 1 more: /);
  const nums = rows.flatMap((r) => [...r.matchAll(/(\d[\d,]*)/g)].map((m) => Number(m[1].replace(/,/g, ""))).slice(-2));
  const low = nums.filter((_, k) => k % 2 === 0).reduce((a, b) => a + b, 0);
  const high = nums.filter((_, k) => k % 2 === 1).reduce((a, b) => a + b, 0);
  assert.equal(low, 1181);
  assert.equal(high, 2643);
});

test("problem shares when there are no step shares; one share alone is not listed", () => {
  const text = costToText(plan(cost({ byIssue: [{ rank: 1, low: 600, high: 1300 }, { rank: 3, low: 580.5, high: 1343.2 }] })))!;
  assert.match(text, /Biggest problems:\n- #3 Problem 3: .*\n- #1 Problem 1: /);
  const one = costToText(plan(cost({ byStep: [{ order: 1, low: 1180.5, high: 2643.2 }] }), 1))!;
  assert.doesNotMatch(one, /Biggest/);
});

test("example plans say so, live prices line shows, a single figure prints once", () => {
  const text = costToText(plan(cost({ low: 500, high: 500, laborBasis: "volunteer", assumptions: [], pricing: { priced: 6, grounded: 6 } })), { sample: true })!;
  const lines = text.split("\n");
  assert.equal(lines[0], "Example plan, not a real price.");
  assert.equal(lines[2], "$500 for Sebring, FL");
  assert.equal(lines[3], "Rough estimate, not a quote. Labor: volunteer.");
  assert.equal(lines[4], "All 6 material prices looked up live on the web for Sebring, FL.");
  assert.doesNotMatch(text, /Assumes:/);
});
