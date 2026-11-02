/** Section chip counts (chipCount.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chipCount } from "@/lib/client/chipCount";

test("shows the count for a section with items", () => {
  assert.equal(chipCount(1), "1");
  assert.equal(chipCount(7), "7");
  assert.equal(chipCount(99), "99");
});

test("shows nothing for an empty or unknown section", () => {
  assert.equal(chipCount(0), null);
  assert.equal(chipCount(undefined), null);
  assert.equal(chipCount(null), null);
  assert.equal(chipCount(-2), null);
  assert.equal(chipCount(Number.NaN), null);
  assert.equal(chipCount(Number.POSITIVE_INFINITY), null);
});

test("a very long list stops at 99+ and fractions round down", () => {
  assert.equal(chipCount(100), "99+");
  assert.equal(chipCount(250), "99+");
  assert.equal(chipCount(3.7), "3");
  assert.equal(chipCount(0.5), null);
});

test("chip progress shows ticks out of the total once something is ticked", async () => {
  const { chipProgress } = await import("@/lib/client/chipCount");
  assert.deepEqual(chipProgress(3, 8, "steps"), { text: "3/8", spoken: "3 of 8 done", complete: false });
  assert.deepEqual(chipProgress(2, 5, "materials"), { text: "2/5", spoken: "2 of 5 in hand", complete: false });
  assert.deepEqual(chipProgress(4, 4, "steps"), { text: "4/4", spoken: "all 4 done", complete: true });
});

test("chip progress is null before any tick or for an empty section, and never runs past the total", async () => {
  const { chipProgress } = await import("@/lib/client/chipCount");
  assert.equal(chipProgress(0, 8, "steps"), null);
  assert.equal(chipProgress(2, 0, "materials"), null);
  assert.equal(chipProgress(undefined, 8, "steps"), null);
  assert.equal(chipProgress(1, undefined, "steps"), null);
  assert.equal(chipProgress(Number.NaN, 3, "steps"), null);
  assert.deepEqual(chipProgress(9, 3, "steps"), { text: "3/3", spoken: "all 3 done", complete: true });
  assert.equal(chipProgress(150, 120, "materials")?.text, "99+/99+");
});
