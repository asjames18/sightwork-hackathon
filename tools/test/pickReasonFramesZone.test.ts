/** pickReasonFrames zone pass (Grok Bot duration-consistency proposal, 2026-10-31): when zoneIds are given, the reason subset keeps at least one frame per zone, so a long take's areas are not left unseen by the reason step. Flagged swaps still run first, and the zone pass never displaces an endpoint, a flagged frame, or a zone's sole representative. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pickReasonFrames } from "@/lib/pipeline/runPlan";

/** 24 frames, 8 slots: zone 6 is a single frame (21) the even spacing misses. */
function zones24(): number[] {
  const zones: number[] = [];
  for (let i = 0; i < 24; i++) {
    zones.push(i <= 2 ? 0 : i <= 6 ? 1 : i <= 9 ? 2 : i <= 13 ? 3 : i <= 17 ? 4 : i <= 20 ? 5 : i === 21 ? 6 : 7);
  }
  return zones;
}

describe("pickReasonFrames zone pass", () => {
  test("a narrow zone's earliest frame is swapped in, sole representatives kept", () => {
    const subset = pickReasonFrames(24, [], 8, zones24());
    assert.equal(subset.length, 8);
    assert.ok(subset.includes(0) && subset.includes(23));
    assert.ok(subset.includes(21));
    assert.ok(subset.includes(16));
    assert.deepEqual(subset, [0, 3, 7, 10, 16, 20, 21, 23]);
  });

  test("a flagged frame is never displaced by the zone pass", () => {
    const subset = pickReasonFrames(24, [17], 8, zones24());
    assert.ok(subset.includes(17));
    assert.ok(subset.includes(21));
    assert.deepEqual(subset, [0, 3, 7, 10, 17, 20, 21, 23]);
  });

  test("without usable zoneIds the old behavior is unchanged", () => {
    const plain = [0, 2, 4, 6, 9, 11, 13, 15];
    assert.deepEqual(pickReasonFrames(16, [], 8), plain);
    assert.deepEqual(pickReasonFrames(16, [], 8, [0, 1]), plain);
    assert.deepEqual(pickReasonFrames(16, [], 8, Array(16).fill(-1)), plain);
    assert.deepEqual(pickReasonFrames(16, [], 8, Array(16).fill(undefined)), plain);
  });

  test("no cap pressure returns every frame, zones or not", () => {
    assert.deepEqual(pickReasonFrames(5, [], 8, [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4]);
  });

  test("zones outnumbering slots still keep length and endpoints", () => {
    const zones = Array.from({ length: 12 }, (_, i) => Math.floor(i / 2));
    const subset = pickReasonFrames(12, [], 4, zones);
    assert.equal(subset.length, 4);
    assert.ok(subset.includes(0) && subset.includes(11));
  });
});
