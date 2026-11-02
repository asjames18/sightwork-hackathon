import { test } from "node:test";
import assert from "node:assert/strict";
import { canHideDone, hiddenDoneLine, hiddenStepTarget, hideDoneLabel } from "../../src/lib/client/stepsHide";

test("toggle shows only when some steps are done and some are left", () => {
  assert.equal(canHideDone(0, 5), false);
  assert.equal(canHideDone(5, 5), false);
  assert.equal(canHideDone(1, 1), false);
  assert.equal(canHideDone(2, 5), true);
});

test("labels and hidden line read naturally", () => {
  assert.equal(hideDoneLabel(1, false), "Hide the 1 done");
  assert.equal(hideDoneLabel(3, false), "Hide the 3 done");
  assert.equal(hideDoneLabel(3, true), "Show all steps");
  assert.equal(hiddenDoneLine(1, true), "1 done step hidden.");
  assert.equal(hiddenDoneLine(2, true), "2 done steps hidden.");
  assert.equal(hiddenDoneLine(2, false), "");
  assert.equal(hiddenDoneLine(0, true), "");
});

test("a link to a hidden done step is recognized", () => {
  assert.equal(hiddenStepTarget("#step-3", [1, 3]), 3);
  assert.equal(hiddenStepTarget("step-1", [1, 3]), 1);
  assert.equal(hiddenStepTarget("#step-2", [1, 3]), null);
  assert.equal(hiddenStepTarget("#problem-3", [3]), null);
  assert.equal(hiddenStepTarget("#step-3-done", [3]), null);
  assert.equal(hiddenStepTarget("", [3]), null);
});
