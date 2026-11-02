/** Undo after "Mark step N done" on the Next up card (nextUp.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { markedDoneLine, undoMarkLabel, undoMarkOpen, withoutStep } from "@/lib/client/nextUp";

test("the status line and Undo name say which step was marked", () => {
  assert.equal(markedDoneLine(3), "Marked step 3 done.");
  assert.equal(undoMarkLabel(3), "Undo marking step 3 done");
});

test("Undo is on offer right after the mark", () => {
  assert.equal(undoMarkOpen({ order: 1, count: 2 }, [2, 1]), true);
});

test("Undo goes away with no mark, once the step is unticked, or after any other tick change", () => {
  assert.equal(undoMarkOpen(null, [1, 2]), false);
  assert.equal(undoMarkOpen({ order: 1, count: 2 }, [2]), false);
  assert.equal(undoMarkOpen({ order: 1, count: 2 }, [2, 1, 4]), false);
  assert.equal(undoMarkOpen({ order: 1, count: 2 }, [1]), false);
});

test("duplicate ticks in storage don't hide the Undo", () => {
  assert.equal(undoMarkOpen({ order: 1, count: 2 }, [2, 1, 1]), true);
});

test("Undo takes back just that step and keeps the other ticks in order", () => {
  assert.deepEqual(withoutStep([4, 1, 2], 1), [4, 2]);
  assert.deepEqual(withoutStep([1, 1], 1), []);
  assert.deepEqual(withoutStep([2, 3], 1), [2, 3]);
});
