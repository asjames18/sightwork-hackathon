/** Per-problem and per-step cost shares (richer findings, item 7): checked, and summing exactly to the total. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { apportion, issueCostShares, shareLabel, stepCostShares } from "@/lib/costShares";
import { COST_LABEL, type CostRange, type WorkPlan } from "@/lib/types";

const cost = (extra: Record<string, unknown>, low = 412.4, high = 987.6): CostRange =>
  ({ low, high, currency: "USD", label: COST_LABEL, region: "Sebring, FL", laborBasis: "mixed", assumptions: [], ...extra }) as CostRange;
const plan = (c: CostRange | null): Pick<WorkPlan, "costRange" | "issues" | "workOrder"> =>
  ({
    costRange: c,
    issues: [1, 2, 3].map((rank) => ({ rank })) as WorkPlan["issues"],
    workOrder: [1, 2].map((order) => ({ order })) as WorkPlan["workOrder"],
  });
const sum = (m: Map<number, { low: number; high: number }>, k: "low" | "high") => [...m.values()].reduce((a, s) => a + s[k], 0);

describe("apportion", () => {
  test("whole numbers that sum exactly to the rounded total", () => {
    const parts = apportion([1, 1, 1], 100)!;
    assert.deepEqual(parts, [34, 33, 33]);
    assert.equal(apportion([10.4, 20.3, 30.3], 61)!.reduce((a, b) => a + b), 61);
    assert.deepEqual(apportion([], 0), []);
    assert.equal(apportion([0, 0], 10), null);
    assert.deepEqual(apportion([0, 0], 0), [0, 0]);
  });
});

describe("cost shares", () => {
  test("per problem and per step, each summing exactly to the displayed total", () => {
    const p = plan(
      cost({
        byIssue: [{ rank: 1, low: 137.47, high: 329.2 }, { rank: 2, low: 137.47, high: 329.2 }, { rank: 3, low: 137.46, high: 329.2 }],
        byStep: [{ order: 1, low: 300, high: 700 }, { order: 2, low: 112.4, high: 287.6 }],
      }),
    );
    const byIssue = issueCostShares(p)!;
    const byStep = stepCostShares(p)!;
    assert.equal(sum(byIssue, "low"), 412);
    assert.equal(sum(byIssue, "high"), 988);
    assert.equal(sum(byStep, "low"), 412);
    assert.equal(sum(byStep, "high"), 988);
    for (const s of byIssue.values()) assert.ok(s.low <= s.high && Number.isInteger(s.low));
  });
  test("a slightly-off server sum is scaled to the total; far off is dropped", () => {
    const near = issueCostShares(plan(cost({ byIssue: [{ rank: 1, low: 200, high: 500 }, { rank: 2, low: 210, high: 480 }] })))!;
    assert.equal(sum(near, "low"), 412);
    assert.equal(sum(near, "high"), 988);
    assert.equal(issueCostShares(plan(cost({ byIssue: [{ rank: 1, low: 100, high: 200 }] }))), null);
  });
  test("bad lists are ignored, and today's plans (no lists) get none", () => {
    assert.equal(issueCostShares(plan(cost({}))), null);
    assert.equal(issueCostShares(plan(null)), null);
    assert.equal(issueCostShares(plan(cost({ byIssue: [{ rank: 9, low: 412.4, high: 987.6 }] }))), null, "unknown rank");
    assert.equal(issueCostShares(plan(cost({ byIssue: [{ rank: 1, low: 500, high: 400 }] }, 500, 400))), null, "inverted");
    assert.equal(issueCostShares(plan(cost({ byIssue: [{ rank: 1, low: 206.2, high: 493.8 }, { rank: 1, low: 206.2, high: 493.8 }] }))), null, "duplicate");
    assert.equal(stepCostShares(plan(cost({ byStep: "lots" }))), null);
  });
  test("labels", () => {
    assert.equal(shareLabel({ low: 25, high: 60 }), "$25–60");
    assert.equal(shareLabel({ low: 40, high: 40 }), "$40");
    assert.equal(shareLabel({ low: 1200, high: 2500 }), "$1,200–2,500");
  });
});
