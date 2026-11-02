import { test } from "node:test";
import assert from "node:assert/strict";
import { costLeft, costLeftLine } from "@/lib/client/costLeft";
import type { CostShare } from "@/lib/costShares";

const steps = [{ order: 1 }, { order: 2 }, { order: 3 }, { order: 4 }];
const costs = new Map<number, CostShare>([
  [1, { key: 1, low: 480, high: 1121 }],
  [2, { key: 2, low: 520, high: 1120 }],
  [3, { key: 3, low: 60, high: 140 }],
  [4, { key: 4, low: 121, high: 262 }],
]);

test("costLeft: nothing until a step is ticked, then the unticked shares summed", () => {
  assert.equal(costLeft(steps, costs, []), null);
  assert.equal(costLeft(steps, costs, [9]), null);
  assert.deepEqual(costLeft(steps, costs, [1]), { low: 701, high: 1522, steps: 3 });
  assert.deepEqual(costLeft(steps, costs, [1, 2, 3]), { low: 121, high: 262, steps: 1 });
});

test("costLeft: null when everything is done or there are no step costs", () => {
  assert.equal(costLeft(steps, costs, [1, 2, 3, 4]), null);
  assert.equal(costLeft(steps, null, [1]), null);
  assert.equal(costLeft(steps, new Map(), [1]), null);
});

test("costLeftLine: plural, last step, single figure and free steps", () => {
  assert.equal(costLeftLine(null), "");
  assert.equal(costLeftLine({ low: 701, high: 1522, steps: 3 }), "About $701–$1,522 of this is for the 3 steps not ticked yet.");
  assert.equal(costLeftLine({ low: 121, high: 262, steps: 1 }), "About $121–$262 of this is for the last step.");
  assert.equal(costLeftLine({ low: 40, high: 40, steps: 2 }), "About $40 of this is for the 2 steps not ticked yet.");
  assert.equal(costLeftLine({ low: 0, high: 0, steps: 2 }), "Nothing left to spend on the 2 steps not ticked yet.");
});
