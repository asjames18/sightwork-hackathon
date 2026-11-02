/** Hours of work left on the unticked steps, shown under the step progress line. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hoursLeft, hoursLeftLine } from "@/lib/client/crewSummary";
import type { WorkStep } from "@/lib/types";

const step = (order: number, hours?: [number, number]): WorkStep => ({ order, title: `s${order}`, detail: "", hours });
const plan = [step(1, [2, 3]), step(2, [4, 6]), step(3, [2, 3]), step(4, [6, 8])];

test("nothing ticked, or only ticks for steps not in the plan, shows nothing", () => {
  assert.equal(hoursLeft(plan, []), null);
  assert.equal(hoursLeft(plan, [9]), null);
  assert.equal(hoursLeftLine(null), "");
});

test("sums the unticked steps", () => {
  const left = hoursLeft(plan, [1]);
  assert.deepEqual(left, { hours: [12, 17], partial: false, steps: 3 });
  assert.equal(hoursLeftLine(left), "About 12–17 h of work left on the 3 steps not ticked yet.");
});

test("one step left reads as the last step", () => {
  assert.equal(hoursLeftLine(hoursLeft(plan, [1, 2, 3])), "About 6–8 h of work left on the last step.");
});

test("all done shows nothing", () => {
  assert.equal(hoursLeft(plan, [4, 3, 2, 1]), null);
});

test("unticked steps without hours make it a floor, and none with hours shows nothing", () => {
  const mixed = [step(1, [2, 3]), step(2), step(3, [1, 1])];
  assert.equal(hoursLeftLine(hoursLeft(mixed, [1])), "At least 1 h of work left on the 2 steps not ticked yet.");
  assert.equal(hoursLeft([step(1, [2, 3]), step(2)], [1]), null);
});
