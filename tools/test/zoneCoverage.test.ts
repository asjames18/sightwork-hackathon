/** Every zone keeps a frame when frames are trimmed (complements finding B). Pure logic, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { coverZones, evenlyPick, missingZones, trimFramesCoveringZones, zoneRepresentatives } from "@/lib/client/zoneCoverage";
import { planSegmentFrames } from "@/lib/pipeline/segment";

/** Finding B's take: zone 0 = frames 0-15, 1 = 16-31, 2 = 32-43, 3 = 44-47. */
const ZONES48 = Array.from({ length: 48 }, (_, i) => (i < 16 ? 0 : i < 32 ? 1 : i < 44 ? 2 : 3));
const ALL48 = Array.from({ length: 48 }, (_, i) => i);

describe("zone coverage", () => {
  test("with no zoneIds it matches segment.ts's count-frame picks exactly", () => {
    const plan = planSegmentFrames({ frameCount: 48 });
    const picked = coverZones(plan.hazardFrames, [], plan.countFrames.length);
    assert.deepEqual(picked, plan.countFrames);
    assert.deepEqual(evenlyPick(plan.hazardFrames, plan.countFrames.length), plan.countFrames);
  });

  test("finding B: today's count frames skip the last area; coverZones keeps it", () => {
    const plan = planSegmentFrames({ frameCount: 48 });
    assert.deepEqual(missingZones(plan.hazardFrames, plan.countFrames, ZONES48), ["3"]);
    const picked = coverZones(plan.hazardFrames, ZONES48, plan.countFrames.length);
    assert.equal(picked.length, plan.countFrames.length);
    assert.deepEqual(missingZones(plan.hazardFrames, picked, ZONES48), []);
    assert.ok(picked.some((i) => i >= 44));
    assert.deepEqual(picked, [...new Set(picked)].sort((a, b) => a - b));
  });

  test("representative is the middle of a zone's longest run; a revisit rejoins the zone", () => {
    const zones = [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 2];
    assert.deepEqual(zoneRepresentatives(zones.map((_, i) => i), zones), [7, 3, 10]);
  });

  test("unzoned frames are their own zone, never merged with zone 0", () => {
    const zones = [0, 0, 0, 0, undefined, undefined];
    const picked = coverZones([0, 1, 2, 3, 4, 5], zones, 2);
    assert.deepEqual(missingZones([0, 1, 2, 3, 4, 5], picked, zones), []);
  });

  test("more zones than slots: the biggest zones win, earlier on a tie", () => {
    const zones = [0, 1, 1, 1, 2, 2, 3];
    assert.deepEqual(coverZones([0, 1, 2, 3, 4, 5, 6], zones, 2), [2, 4]);
  });

  test("edge cases: empty, zero count, count >= candidates", () => {
    assert.deepEqual(coverZones([], [0], 3), []);
    assert.deepEqual(coverZones([1, 2], [0, 1, 2], 0), []);
    assert.deepEqual(coverZones([1, 2], [0, 1, 2], 5), [1, 2]);
  });

  test("random takes: always the right size, sorted, unique, every zone covered when it fits", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(rnd() * 48);
      const zones: (number | undefined)[] = [];
      let z = 0;
      for (let i = 0; i < n; i++) {
        if (rnd() < 0.15) z = Math.floor(rnd() * 6);
        zones.push(rnd() < 0.05 ? undefined : z);
      }
      const cands = Array.from({ length: n }, (_, i) => i).filter(() => rnd() < 0.8);
      const count = Math.floor(rnd() * (cands.length + 2));
      const picked = coverZones(cands, zones, count);
      assert.equal(picked.length, Math.min(count, cands.length));
      assert.deepEqual(picked, [...new Set(picked)].sort((a, b) => a - b));
      for (const i of picked) assert.ok(cands.includes(i));
      const zoneCount = new Set(cands.map((i) => (typeof zones[i] === "number" ? zones[i] : "u"))).size;
      if (count >= zoneCount) assert.deepEqual(missingZones(cands, picked, zones), []);
    }
  });

  test("trimFramesCoveringZones: under the cap is a no-op; over it keeps time order and every zone", () => {
    const frames = ZONES48.map((zoneId, i) => ({ tSec: i * 2, dataUrl: "x", zoneId }));
    assert.equal(trimFramesCoveringZones(frames, 48), frames);
    const out = trimFramesCoveringZones(frames, 5);
    assert.equal(out.length, 5);
    assert.deepEqual(new Set(out.map((f) => f.zoneId)), new Set([0, 1, 2, 3]));
    for (let i = 1; i < out.length; i++) assert.ok(out[i].tSec > out[i - 1].tSec);
  });
});
