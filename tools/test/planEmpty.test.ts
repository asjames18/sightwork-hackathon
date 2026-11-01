/** Empty-state lines for a plan without work steps (planEmpty.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { noStepsCostLine, noStepsLine } from "@/lib/client/planEmpty";

test("no problems: nothing needs fixing", () => {
  assert.equal(noStepsLine(0), "No work steps, since nothing needs fixing.");
});

test("problems but no steps never claims nothing needs fixing", () => {
  assert.match(noStepsLine(1), /^This run didn’t lay out work steps for the problem above\./);
  assert.match(noStepsLine(4), /for the 4 problems above\./);
  assert.doesNotMatch(noStepsLine(4), /nothing needs fixing/);
});

test("cost line only when there are materials and no steps", () => {
  assert.equal(noStepsCostLine(2, 3), null);
  assert.equal(noStepsCostLine(0, 0), null);
  const line = noStepsCostLine(0, 3);
  assert.ok(line);
  assert.match(line!, /no work steps to price/);
  assert.doesNotMatch(line!, /try again/i);
});
