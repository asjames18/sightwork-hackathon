/** Problems filter keeps its place (keepInView.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { keepInViewDelta } from "@/lib/client/keepInView";

test("a control already between the sticky line and the window bottom does not move", () => {
  assert.equal(keepInViewDelta({ top: 200, bottom: 252 }, 120, 800), 0);
  assert.equal(keepInViewDelta({ top: 128, bottom: 180 }, 120, 800), 0);
});

test("a control under or above the sticky line comes back just below it", () => {
  assert.equal(keepInViewDelta({ top: 100, bottom: 152 }, 120, 800), -28);
  assert.equal(keepInViewDelta({ top: -1500, bottom: -1448 }, 120, 800), -1628);
});

test("a control below the window comes up just far enough to show whole", () => {
  assert.equal(keepInViewDelta({ top: 780, bottom: 832 }, 120, 800), 40);
});

test("a control taller than the space left is pinned at the line, never pushed under it", () => {
  assert.equal(keepInViewDelta({ top: 300, bottom: 1400 }, 120, 800), 172);
});

test("custom gap is honoured", () => {
  assert.equal(keepInViewDelta({ top: 120, bottom: 170 }, 120, 800, 0), 0);
  assert.equal(keepInViewDelta({ top: 120, bottom: 170 }, 120, 800, 16), -16);
});
