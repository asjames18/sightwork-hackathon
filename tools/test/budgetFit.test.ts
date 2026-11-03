import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetFit, budgetFitLine, parseBudget, stepsLabel } from "@/lib/client/budgetFit";
import type { CostShare } from "@/lib/costShares";

const steps = [{ order: 1 }, { order: 2 }, { order: 3 }, { order: 4 }];
const costs = new Map<number, CostShare>([
  [1, { key: 1, low: 480, high: 1121 }],
  [2, { key: 2, low: 520, high: 1120 }],
  [3, { key: 3, low: 60, high: 140 }],
  [4, { key: 4, low: 121, high: 262 }],
]);

test("parseBudget: dollars with or without $ and commas; junk, zero and huge are null", () => {
  assert.equal(parseBudget("1500"), 1500);
  assert.equal(parseBudget(" $2,500 "), 2500);
  assert.equal(parseBudget("2,500.75"), 2500);
  for (const bad of ["", "  ", "abc", "-5", "0", "12e3", "1.2.3", "$", "99999999999"]) assert.equal(parseBudget(bad), null, bad);
});

test("budgetFit: counts leading steps that fit at the high end, then ones that fit at the low end", () => {
  const f = budgetFit(steps, costs, [], 1500)!;
  assert.deepEqual(f.sure, [1]);
  assert.deepEqual(f.maybe, [2, 3, 4]);
  assert.deepEqual(f.next, { order: 2, low: 520, high: 1120 });
  // All four steps cost 1,181 to 2,643, so 1,500 is short by nothing to 1,143 at the extremes.
  assert.deepEqual(f.stillNeed, { low: 0, high: 1143 });
  const g = budgetFit(steps, costs, [], 1100)!;
  assert.deepEqual(g.sure, []);
  assert.deepEqual(g.maybe, [1, 2, 3]);
  assert.deepEqual(g.stillNeed, { low: 81, high: 1543 });
});

test("budgetFit: ticked steps are not counted and a big budget covers everything left", () => {
  const f = budgetFit(steps, costs, [1, 2], 500)!;
  assert.deepEqual(f.left, [3, 4]);
  assert.deepEqual(f.sure, [3, 4]);
  assert.deepEqual(f.maybe, []);
  assert.equal(f.next, null);
  assert.equal(f.stillNeed, null);
  assert.equal(budgetFit(steps, costs, [1, 2, 3, 4], 500), null);
});

test("budgetFit: a step is never skipped to fit a later one", () => {
  const f = budgetFit(steps, costs, [], 200)!;
  assert.deepEqual(f.sure, []);
  assert.deepEqual(f.maybe, []);
});

test("budgetFit: null without costs or a budget", () => {
  assert.equal(budgetFit(steps, null, [], 500), null);
  assert.equal(budgetFit(steps, new Map(), [], 500), null);
  assert.equal(budgetFit(steps, costs, [], null), null);
  assert.equal(budgetFit(steps, costs, [], 0), null);
});

test("stepsLabel: singles, pairs, runs and gaps", () => {
  assert.equal(stepsLabel([]), "");
  assert.equal(stepsLabel([2]), "step 2");
  assert.equal(stepsLabel([2, 3]), "steps 2 and 3");
  assert.equal(stepsLabel([1, 2, 3]), "steps 1–3");
  assert.equal(stepsLabel([1, 2, 3, 5]), "steps 1–3 and 5");
  assert.equal(stepsLabel([6, 1, 4, 7, 8]), "steps 1, 4 and 6–8");
});

test("budgetFitLine: covered, partly covered, not covered, everything covered", () => {
  assert.equal(budgetFitLine(null), "");
  assert.equal(
    budgetFitLine(budgetFit(steps, costs, [], 1500)),
    "$1,500 covers step 1 even if prices come in high. It might also stretch to steps 2–4 if prices come in low. To finish all 4 steps left you\u2019d need up to $1,143 more.",
  );
  assert.equal(
    budgetFitLine(budgetFit(steps, costs, [], 1100)),
    "$1,100 doesn\u2019t cover step 1 for sure (about $480–$1,121). It might stretch to steps 1–3 if prices come in low. To finish all 4 steps left you\u2019d need about $81–$1,543 more.",
  );
  assert.equal(budgetFitLine(budgetFit(steps, costs, [1, 2], 5000)), "$5,000 covers all 2 steps left, even if prices come in high.");
  assert.equal(budgetFitLine(budgetFit(steps, costs, [1, 2, 3], 5000)), "$5,000 covers the last step, even if prices come in high.");
});
