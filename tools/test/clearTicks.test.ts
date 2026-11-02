/** Clear ticks wording and Undo (clearTicks.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clearedLine, restoredTicks, undoClearLabel } from "@/lib/client/clearTicks";

test("says how many ticks were cleared", () => {
  assert.equal(clearedLine(1, "step"), "Cleared 1 ticked step.");
  assert.equal(clearedLine(4, "step"), "Cleared 4 ticked steps.");
  assert.equal(clearedLine(1, "item"), "Cleared 1 ticked item.");
  assert.equal(clearedLine(12, "item"), "Cleared 12 ticked items.");
});

test("says nothing when nothing was cleared", () => {
  assert.equal(clearedLine(0, "step"), "");
  assert.equal(clearedLine(-1, "item"), "");
  assert.equal(clearedLine(Number.NaN, "step"), "");
});

test("names what Undo puts back", () => {
  assert.equal(undoClearLabel(1, "step"), "Undo: tick the step again");
  assert.equal(undoClearLabel(3, "step"), "Undo: tick the 3 steps again");
  assert.equal(undoClearLabel(2, "item"), "Undo: tick the 2 items again");
  assert.equal(undoClearLabel(Number.NaN, "item"), "Undo: tick the item again");
});

test("puts the cleared ticks back with any ticked since, each once and in order", () => {
  assert.deepEqual(restoredTicks([3, 1, 2], []), [1, 2, 3]);
  assert.deepEqual(restoredTicks([1, 2], [5, 2]), [1, 2, 5]);
  assert.deepEqual(restoredTicks([], []), []);
  assert.deepEqual(restoredTicks([0, Number.NaN, 4], [0]), [0, 4]);
});
