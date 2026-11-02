/** When the Back to top button shows (backToTop.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { showBackToTop } from "@/lib/client/backToTop";

test("hidden on the first screen and a half", () => {
  assert.equal(showBackToTop(0, 800), false);
  assert.equal(showBackToTop(800, 800), false);
  assert.equal(showBackToTop(1200, 800), false);
});

test("shown once the reader is well down the plan", () => {
  assert.equal(showBackToTop(1201, 800), true);
  assert.equal(showBackToTop(5000, 667), true);
});

test("hidden for a missing or broken viewport", () => {
  assert.equal(showBackToTop(5000, 0), false);
  assert.equal(showBackToTop(5000, -1), false);
  assert.equal(showBackToTop(Number.NaN, 800), false);
  assert.equal(showBackToTop(5000, Number.POSITIVE_INFINITY), false);
});
