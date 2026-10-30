/** Denser frames (richer findings, item 5): tick plan, caps, scene-change frames. Pure logic, offline. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DENSE, mergeByTime, planDenseTicks, REQUEST_FRAME_CAP, sceneChangeTimes } from "@/lib/client/denseSampling";
import { pickFrameTimes } from "@/lib/client/buildPlanRequest";
import type { FrameSignature } from "@/lib/client/zones";

const MB = 1024 * 1024;
const budget = 2.8 * MB; // Vercel's 4.3 MB budget minus a 33 s WAV

function sig(bin: number): FrameSignature {
  const hist = new Float32Array(64);
  hist[bin] = 1;
  return { hist, dhash: new Uint8Array(8) };
}

describe("dense tick plan", () => {
  test("a 33 s take goes from 17 frames to 26 ticks plus room for scene frames, inside every cap", () => {
    const legacy = pickFrameTimes(33).length;
    assert.equal(legacy, 17);
    const p = planDenseTicks(33, { frameBudgetBytes: budget, legacyCount: legacy })!;
    assert.ok(p);
    assert.equal(p.times.length, 26);
    assert.equal(p.candidates.length, p.times.length);
    assert.ok(p.times.length + p.sceneSlots <= DENSE.maxFrames);
    assert.ok(p.times.length + p.sceneSlots <= REQUEST_FRAME_CAP);
    assert.ok(budget / (p.times.length + p.sceneSlots) >= DENSE.minFrameBytes);
    for (let i = 0; i < p.times.length; i++) {
      assert.equal(p.candidates[i][0], p.times[i], "tick first");
      assert.ok(p.times[i] >= 0.25 && p.times[i] <= 32.75);
      if (i) assert.ok(p.times[i] > p.times[i - 1]);
    }
  });
  test("longer takes keep the 2 s ticks", () => {
    assert.equal(planDenseTicks(46, { frameBudgetBytes: budget, legacyCount: 23 }), null);
    assert.equal(planDenseTicks(90, { frameBudgetBytes: budget, legacyCount: 45 }), null);
  });
  test("a tight byte budget caps the frames, or falls back when it can't beat the 2 s ticks", () => {
    const p = planDenseTicks(33, { frameBudgetBytes: 20 * DENSE.minFrameBytes, legacyCount: 17 })!;
    assert.ok(p.times.length + p.sceneSlots <= 20);
    assert.ok(p.times.length > 17);
    assert.equal(planDenseTicks(33, { frameBudgetBytes: 17 * DENSE.minFrameBytes, legacyCount: 17 }), null);
    assert.equal(planDenseTicks(33, { frameBudgetBytes: 0, legacyCount: 17 }), null);
  });
  test("a lower maxFrames option is respected", () => {
    const p = planDenseTicks(33, { frameBudgetBytes: budget, legacyCount: 17, maxFrames: 22 })!;
    assert.ok(p.times.length + p.sceneSlots <= 22);
    assert.equal(planDenseTicks(33, { frameBudgetBytes: budget, legacyCount: 17, maxFrames: 17 }), null);
  });
  test("bad durations keep the old path", () => {
    for (const d of [0, -1, NaN, Infinity]) assert.equal(planDenseTicks(d, { frameBudgetBytes: budget, legacyCount: 1 }), null);
  });
});

describe("scene-change frames", () => {
  test("halfway between ticks where the colour jumps, biggest first, at most max, in time order", () => {
    const times = [1, 2, 3, 4, 5, 6];
    const sigs = [sig(0), sig(0), sig(5), sig(5), sig(9), sig(9)];
    assert.deepEqual(sceneChangeTimes(times, sigs, 4), [2.5, 4.5]);
    assert.equal(sceneChangeTimes(times, sigs, 1).length, 1);
    assert.deepEqual(sceneChangeTimes(times, sigs.map(() => sig(0)), 4), []);
  });
  test("unreadable pixels or mismatched lists add nothing", () => {
    assert.deepEqual(sceneChangeTimes([1, 2], [sig(0), null], 4), []);
    assert.deepEqual(sceneChangeTimes([1, 2, 3], [sig(0), sig(9)], 4), []);
    assert.deepEqual(sceneChangeTimes([1, 2], [sig(0), sig(9)], 0), []);
  });
  test("merge keeps time order", () => {
    const merged = mergeByTime([{ tSec: 1 }, { tSec: 3 }], [{ tSec: 2 }, { tSec: 4 }]);
    assert.deepEqual(merged.map((m) => m.tSec), [1, 2, 3, 4]);
  });
});
