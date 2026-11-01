/** Sticky plan chips: which section is current (sectionSpy.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeSection, chipScrollDelta } from "@/lib/client/sectionSpy";

const secs = [
  { id: "problems", top: 400 },
  { id: "counts", top: 1200 },
  { id: "steps", top: 2000 },
];

test("nothing is current before the first section reaches the line", () => {
  assert.equal(activeSection(secs, 120), null);
});

test("the last section whose top passed the line is current", () => {
  assert.equal(activeSection(secs.map((s, i) => (i === 0 ? { ...s, top: 50 } : s)), 120), "problems");
  assert.equal(activeSection([{ id: "a", top: -900 }, { id: "b", top: 121 }, { id: "c", top: 600 }], 120), "b");
});

test("at the bottom of the page the last section wins", () => {
  assert.equal(activeSection(secs, 120, true), "steps");
  assert.equal(activeSection([], 120, true), null);
});

test("chip row scrolls only when the chip is cut off", () => {
  const row = { left: 0, right: 375 };
  assert.equal(chipScrollDelta({ left: 100, right: 200 }, row), 0);
  assert.equal(chipScrollDelta({ left: 330, right: 420 }, row), 61);
  assert.equal(chipScrollDelta({ left: -40, right: 50 }, row), -56);
});
