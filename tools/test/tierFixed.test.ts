import { test } from "node:test";
import assert from "node:assert/strict";
import { tierFixed, tierFixedSr } from "@/lib/client/tierFixed";
import type { WorkStep } from "@/lib/types";

const step = (order: number, fixes: number[]) => ({ order, title: `Step ${order}`, fixes }) as unknown as WorkStep;
const workOrder = [step(1, [1]), step(2, [2, 3]), step(3, [3])];
const tier = [{ rank: 1 }, { rank: 3 }];

test("tierFixed: nothing until a step is ticked or while none in the tier is fixed", () => {
  assert.equal(tierFixed(tier, workOrder, []), null);
  assert.equal(tierFixed(tier, workOrder, [2]), null);
  assert.equal(tierFixed([{ rank: 9 }], workOrder, [1]), null);
});

test("tierFixed: some fixed, then all fixed", () => {
  const some = tierFixed(tier, workOrder, [1]);
  assert.deepEqual(some, { fixed: 1, tracked: 2, all: false, label: "1 fixed" });
  assert.equal(tierFixedSr(some!), "1 of 2 fixed");
  assert.deepEqual(tierFixed(tier, workOrder, [1, 2, 3]), { fixed: 2, tracked: 2, all: true, label: "all fixed" });
});

test("tierFixed: a problem no step fixes keeps the label a count, not 'all fixed'", () => {
  const t = tierFixed([{ rank: 1 }, { rank: 9 }], workOrder, [1]);
  assert.deepEqual(t, { fixed: 1, tracked: 1, all: true, label: "1 fixed" });
});
