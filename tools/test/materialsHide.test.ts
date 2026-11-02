import { test } from "node:test";
import assert from "node:assert/strict";
import { canHideGot, hiddenGotLine, hideGotLabel } from "../../src/lib/client/materialsList";

test("hideGotLabel: names how many are in hand, or offers to show all", () => {
  assert.equal(hideGotLabel(1, false), "Hide the 1 in hand");
  assert.equal(hideGotLabel(3, false), "Hide the 3 in hand");
  assert.equal(hideGotLabel(3, true), "Show all items");
});

test("canHideGot: only when something is ticked and something is left", () => {
  assert.equal(canHideGot(0, 5), false);
  assert.equal(canHideGot(2, 5), true);
  assert.equal(canHideGot(5, 5), false);
  assert.equal(canHideGot(1, 1), false);
  assert.equal(canHideGot(0, 0), false);
});

test("hiddenGotLine: a short note only while items are hidden", () => {
  assert.equal(hiddenGotLine(2, true), "2 in hand hidden.");
  assert.equal(hiddenGotLine(2, false), "");
  assert.equal(hiddenGotLine(0, true), "");
});
