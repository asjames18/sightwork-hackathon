/** Orientation tip on the upload card: a soft note for an upright take in a room that is not small. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SIDEWAYS_TIP, UPRIGHT_RATIO, isUpright, sidewaysTip } from "@/lib/client/takeOrientation";

test("an upright picture is called upright, a sideways or square one is not", () => {
  assert.equal(isUpright(1080, 1920), true);
  assert.equal(isUpright(1920, 1080), false);
  assert.equal(isUpright(1000, 1000), false);
  assert.equal(isUpright(1000, 1000 * UPRIGHT_RATIO), true);
  assert.equal(isUpright(1000, 1000 * UPRIGHT_RATIO - 1), false);
});

test("unknown or broken sizes never count as upright", () => {
  assert.equal(isUpright(null, 1920), false);
  assert.equal(isUpright(1080, undefined), false);
  assert.equal(isUpright(0, 1920), false);
  assert.equal(isUpright(1080, 0), false);
  assert.equal(isUpright(Number.NaN, 1920), false);
  assert.equal(isUpright(1080, Number.POSITIVE_INFINITY), false);
});

test("the tip shows for an upright take in medium, large and extra large rooms", () => {
  for (const size of ["medium", "large", "xl", undefined, null]) {
    assert.equal(sidewaysTip(1080, 1920, size), SIDEWAYS_TIP);
  }
});

test("the tip stays quiet for small rooms and for sideways takes", () => {
  assert.equal(sidewaysTip(1080, 1920, "small"), null);
  assert.equal(sidewaysTip(1920, 1080, "large"), null);
  assert.equal(sidewaysTip(null, null, "large"), null);
});
