/** Before/after preset views (beforeAfter.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPARE_VIEWS, activeCompareView, clampComparePos, compareValueText } from "@/lib/client/beforeAfter";

test("three presets in reading order: Before, Compare, After", () => {
  assert.deepEqual(
    COMPARE_VIEWS.map((v) => [v.label, v.pos]),
    [
      ["Before", 100],
      ["Compare", 50],
      ["After", 0],
    ],
  );
});

test("a preset is active only on its exact value", () => {
  assert.equal(activeCompareView(100), "before");
  assert.equal(activeCompareView(50), "compare");
  assert.equal(activeCompareView(0), "after");
  assert.equal(activeCompareView(51), null);
  assert.equal(activeCompareView(99), null);
});

test("values are clamped and rounded", () => {
  assert.equal(clampComparePos(-5), 0);
  assert.equal(clampComparePos(140), 100);
  assert.equal(clampComparePos(49.6), 50);
  assert.equal(clampComparePos(Number.NaN), 50);
  assert.equal(activeCompareView(120), "before");
});

test("screen reader text names both pictures", () => {
  assert.equal(compareValueText(51), "51% before, 49% after");
  assert.equal(compareValueText(100), "Showing only the before picture");
  assert.equal(compareValueText(0), "Showing only the after picture");
});
