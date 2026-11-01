/** Zone grouping when frames are far apart (long takes): lone frames that are a real area keep their zone. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { assignZones, frameSignature, medianSpacingSec, signatureDistance, SIGNATURE_SIDE, FOLD_NEAR_BAR, type FrameSignature } from "@/lib/client/zones";
import { withZoneIds } from "@/lib/client/buildPlanRequest";

const S = SIGNATURE_SIDE;

/** Striped test frame in two colours; shift `t` moves the stripes a little. */
function frame(a: [number, number, number], b: [number, number, number], t = 0): FrameSignature {
  const d = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const [r, g, bl] = (x + t) % 16 < 8 ? a : b;
      const o = (y * S + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = bl;
      d[o + 3] = 255;
    }
  return frameSignature(d, S, S);
}

const stage = (t = 0) => frame([200, 40, 40], [240, 220, 200], t);
/** Same layout as the stage, cream turned warmer: a colour cut, but close overall (a lighting change). */
const stageWarm = () => frame([200, 40, 40], [240, 220, 120]);
/** A different area: other colours, other stripes. */
const lobby = () => frame([30, 60, 200], [20, 20, 20], 4);

describe("lone frames by frame spacing", () => {
  test("the test frames sit on the right sides of the fold bar", () => {
    assert.ok(signatureDistance(stageWarm(), stage()) < FOLD_NEAR_BAR);
    assert.ok(signatureDistance(lobby(), stage()) >= FOLD_NEAR_BAR);
  });
  test("at 2 s (and with no spacing given) any lone frame folds back, as before", () => {
    const sigs = [stage(), stage(1), lobby(), stage(2), stage(3)];
    assert.deepEqual(assignZones(sigs), [0, 0, 0, 0, 0]);
    assert.deepEqual(assignZones(sigs, { frameSpacingSec: 2 }), [0, 0, 0, 0, 0]);
    assert.deepEqual(assignZones(sigs, { frameSpacingSec: 3.9 }), [0, 0, 0, 0, 0]);
  });
  test("6 s apart, a lone frame of a different area keeps its own zone", () => {
    const sigs = [stage(), stage(1), lobby(), stage(2), stage(3)];
    assert.deepEqual(assignZones(sigs, { frameSpacingSec: 6 }), [0, 0, 1, 0, 0]);
  });
  test("6 s apart, a lone frame that looks like its neighbours still folds", () => {
    const sigs = [stage(), stage(1), stageWarm(), stage(2), stage(3)];
    assert.deepEqual(assignZones(sigs, { frameSpacingSec: 6 }), [0, 0, 0, 0, 0]);
  });
  test("a bad spacing value falls back to the 2 s rules", () => {
    const sigs = [stage(), stage(1), lobby(), stage(2), stage(3)];
    for (const v of [NaN, 0, -5, Infinity]) assert.deepEqual(assignZones(sigs, { frameSpacingSec: v }), [0, 0, 0, 0, 0]);
  });
});

describe("medianSpacingSec", () => {
  test("median gap of sorted times; unsorted and repeated times are fine", () => {
    assert.equal(medianSpacingSec([0, 2, 4, 6]), 2);
    assert.equal(medianSpacingSec([12.5, 0, 6.25, 18.75]), 6.25);
    assert.equal(medianSpacingSec([0, 2, 2, 4, 10]), 2);
    assert.equal(medianSpacingSec([0, 1, 3, 6]), 2);
  });
  test("a short dense burst doesn't hide wide spacing", () => {
    assert.equal(medianSpacingSec([0, 6, 6.5, 12, 18, 24]), 6);
  });
  test("fewer than two distinct times, or non-finite ones, give undefined", () => {
    assert.equal(medianSpacingSec([]), undefined);
    assert.equal(medianSpacingSec([3]), undefined);
    assert.equal(medianSpacingSec([3, 3]), undefined);
    assert.equal(medianSpacingSec([NaN, 1]), undefined);
  });
});

describe("zone ids on the request use the frames' own spacing", () => {
  const sigs = [stage(), stage(1), lobby(), stage(2), stage(3)];
  const at = (gap: number) => [0, 1, 2, 3, 4].map((i) => ({ tSec: i * gap, dataUrl: "data:image/jpeg;base64,AAAA" }));
  test("a 5-minute take (frames ~6 s apart) keeps a lone area", () => {
    assert.deepEqual(withZoneIds(at(6.25), sigs).map((f) => f.zoneId), [0, 0, 1, 0, 0]);
  });
  test("a short take (frames 2 s apart) folds it as before", () => {
    assert.deepEqual(withZoneIds(at(2), sigs).map((f) => f.zoneId), [0, 0, 0, 0, 0]);
  });
});
