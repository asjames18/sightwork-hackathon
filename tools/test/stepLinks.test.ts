/** Problem cards and work steps link to each other (stepLinks.ts). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixLinks, fixedInLabel, problemAnchor, stepAnchor, stepsFixing } from "@/lib/client/stepLinks";
import type { WorkStep } from "@/lib/types";

const steps: WorkStep[] = [
  { order: 1, title: "Tape down the cable", detail: "", fixes: [1] },
  { order: 2, title: "Swap the exit sign bulb", detail: "", fixes: [2, 2] },
  { order: 3, title: "Clean up", detail: "" },
  { order: 4, title: "Paint the back wall", detail: "", fixes: [3, 1] },
];

test("stepsFixing lists every step that fixes a rank, in order, once", () => {
  assert.deepEqual(stepsFixing(steps, 1), [1, 4]);
  assert.deepEqual(stepsFixing(steps, 2), [2]);
  assert.deepEqual(stepsFixing(steps, 9), []);
  assert.deepEqual(stepsFixing([...steps].reverse(), 1), [1, 4]);
  assert.deepEqual(stepsFixing([], 1), []);
});

test("fixLinks links only ranks with a problem card and drops repeats", () => {
  assert.deepEqual(fixLinks([3, 1, 5, 3], new Set([1, 2, 3])), { linked: [3, 1], plain: [5] });
  assert.deepEqual(fixLinks(undefined, new Set([1])), { linked: [], plain: [] });
  assert.deepEqual(fixLinks([2], new Set()), { linked: [], plain: [2] });
});

test("fixedInLabel reads as plain English", () => {
  assert.equal(fixedInLabel([]), null);
  assert.equal(fixedInLabel([3]), "Fixed in step 3");
  assert.equal(fixedInLabel([2, 4]), "Fixed in steps 2 and 4");
  assert.equal(fixedInLabel([1, 3, 5]), "Fixed in steps 1, 3 and 5");
});

test("anchor ids stay apart from the step checkbox ids", () => {
  assert.equal(problemAnchor(2), "problem-2");
  assert.equal(stepAnchor(4), "step-4");
  assert.notEqual(stepAnchor(4), "step-4-done");
});
