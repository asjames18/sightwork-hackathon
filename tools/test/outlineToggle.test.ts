import { test } from "node:test";
import assert from "node:assert/strict";
import { canToggleOutline, outlineToggleLabel, outlineToggleStatus } from "../../src/lib/client/outlineToggle";

test("outlineToggleLabel: says what a tap will do", () => {
  assert.equal(outlineToggleLabel(false), "Hide outline");
  assert.equal(outlineToggleLabel(true), "Show outline");
});

test("outlineToggleStatus: announces the new state and names SAM only for SAM boxes", () => {
  assert.equal(outlineToggleStatus(true, "sam"), "Outline hidden. The whole photo is in view.");
  assert.equal(outlineToggleStatus(false, "sam"), "Outline shown, as drawn by SAM 3.1.");
  assert.equal(outlineToggleStatus(false, "model"), "Outline shown.");
  assert.equal(outlineToggleStatus(false), "Outline shown.");
});

test("canToggleOutline: only a real four-number box with area", () => {
  assert.equal(canToggleOutline([100, 200, 600, 700]), true);
  assert.equal(canToggleOutline(undefined), false);
  assert.equal(canToggleOutline(null), false);
  assert.equal(canToggleOutline([100, 200, 600]), false);
  assert.equal(canToggleOutline([100, 200, Number.NaN, 700]), false);
  assert.equal(canToggleOutline([100, 200, "600", 700]), false);
  assert.equal(canToggleOutline([500, 200, 500, 700]), false);
  assert.equal(canToggleOutline([100, 700, 600, 700]), false);
});
