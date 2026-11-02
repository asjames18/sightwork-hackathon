import { test } from "node:test";
import assert from "node:assert/strict";
import { proofNavLabel, proofNavPos, proofNavTarget } from "../../src/lib/client/proofNav";

test("proofNavPos: finds the open photo, null when alone or missing", () => {
  const a = {}, b = {}, c = {};
  assert.deepEqual(proofNavPos([a, b, c], b), { index: 1, count: 3 });
  assert.equal(proofNavPos([a], a), null);
  assert.equal(proofNavPos([a, b], c), null);
  assert.equal(proofNavPos([a, b], null), null);
  assert.equal(proofNavPos([a, b], undefined), null);
});

test("proofNavTarget: steps one either way and stops at the ends", () => {
  assert.equal(proofNavTarget({ index: 1, count: 3 }, 1), 2);
  assert.equal(proofNavTarget({ index: 1, count: 3 }, -1), 0);
  assert.equal(proofNavTarget({ index: 0, count: 3 }, -1), null);
  assert.equal(proofNavTarget({ index: 2, count: 3 }, 1), null);
  assert.equal(proofNavTarget(null, 1), null);
});

test("proofNavLabel: counts from one", () => {
  assert.equal(proofNavLabel({ index: 0, count: 5 }), "Photo 1 of 5");
  assert.equal(proofNavLabel({ index: 4, count: 5 }), "Photo 5 of 5");
});
