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
