import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRunCost, runCostLine } from "../../src/lib/client/runCost";
import type { WorkPlan } from "../../src/lib/types";

const plan = (meta: WorkPlan["meta"]) => ({ meta }) as unknown as WorkPlan;

test("formatRunCost reads plainly at each size", () => {
  assert.equal(formatRunCost(0.004), "less than 1 cent");
  assert.equal(formatRunCost(0.94), "about 94 cents");
  assert.equal(formatRunCost(0.996), "about $1.00");
  assert.equal(formatRunCost(1.114), "about $1.11");
});

test("runCostLine shows the total on a real plan", () => {
  assert.equal(runCostLine(plan({ costUsd: 0.94 })), "The AI model calls for this plan cost about 94 cents.");
  assert.equal(runCostLine(plan({ costUsd: 1.11 })), "The AI model calls for this plan cost about $1.11.");
});

test("runCostLine shows nothing for samples, examples, or a missing or bad total", () => {
  assert.equal(runCostLine(plan({ costUsd: 0.5 }), { sample: true }), null);
  assert.equal(runCostLine(plan({ costUsd: 0.5, isExample: true })), null);
  assert.equal(runCostLine(plan(undefined)), null);
  assert.equal(runCostLine(plan({ costUsd: 0 })), null);
  assert.equal(runCostLine(plan({ costUsd: Number.NaN })), null);
});
