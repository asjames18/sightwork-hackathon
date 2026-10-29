/** Proposal B zone grouping: pure client logic, no DOM, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assignZones,
  frameSignature,
  hashDistance,
  histDistance,
  renumber,
  signatureDistance,
  zoneChangeIndices,
  SIGNATURE_SIDE,
  type FrameSignature,
} from "@/lib/client/zones";
import { withZoneIds } from "@/lib/client/buildPlanRequest";

const S = SIGNATURE_SIDE;

/** RGBA image from a per-pixel colour function. */
function image(fn: (x: number, y: number) => [number, number, number], w = S, h = S): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const o = (y * w + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  return d;
}

/** A synthetic "area": its own palette and layout, with a small camera shift `t`. */
function area(kind: number, t = 0): FrameSignature {
  const palettes: [number, number, number][][] = [
    [[200, 40, 40], [240, 220, 200]], // red carpet, cream walls (stage)
    [[30, 60, 200], [20, 20, 20]], // blue chairs, dark floor (rows)
    [[40, 180, 60], [250, 250, 250]], // green exit sign, white wall (back)
    [[120, 80, 30], [200, 160, 90]], // wood (lobby)
  ];
  const [a, b] = palettes[kind];
  const px = image((x, y) => {
    const xs = x + t;
    const on = kind % 2 === 0 ? xs % 16 < 8 : (y + t) % 12 < 5;
    return on ? a : b;
  });
  return frameSignature(px, S, S);
}

describe("frame signatures", () => {
  test("histogram sums to 1 and identical frames are distance 0", () => {
    const s = area(0);
    const total = s.hist.reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(total - 1) < 1e-4);
    assert.equal(histDistance(s.hist, area(0).hist), 0);
    assert.equal(hashDistance(s.dhash, area(0).dhash), 0);
    assert.equal(signatureDistance(s, area(0)), 0);
  });
  test("different areas are far apart in colour", () => {
    assert.ok(histDistance(area(0).hist, area(1).hist) > 0.9);
    assert.ok(histDistance(area(0).hist, area(2).hist) >= 0.5);
    assert.ok(signatureDistance(area(0), area(1)) > 0.3);
  });
  test("dHash reads layout: a left-to-right ramp vs its mirror", () => {
    const ramp = frameSignature(image((x) => [x * 8, x * 8, x * 8]), S, S);
    const mirror = frameSignature(image((x) => [255 - x * 8, 255 - x * 8, 255 - x * 8]), S, S);
    assert.equal(hashDistance(ramp.dhash, mirror.dhash), 1);
  });
  test("tolerates empty or short pixel buffers", () => {
    const s = frameSignature(new Uint8ClampedArray(0), 0, 0);
    assert.equal(s.hist.length, 64);
    assert.equal(s.dhash.length, 8);
  });
});

describe("zone grouping", () => {
  test("empty in, empty out; one frame is zone 0", () => {
    assert.deepEqual(assignZones([]), []);
    assert.deepEqual(assignZones([area(0)]), [0]);
  });
  test("a steady walk through one area stays one zone", () => {
    const sigs = [0, 1, 2, 3, 4, 5].map((t) => area(1, t));
    assert.deepEqual(assignZones(sigs), [0, 0, 0, 0, 0, 0]);
  });
  test("new areas open new zones in order of first appearance", () => {
    const sigs = [area(0), area(0, 1), area(1), area(1, 1), area(2), area(2, 1)];
    assert.deepEqual(assignZones(sigs), [0, 0, 1, 1, 2, 2]);
  });
  test("walking back to an area rejoins its earlier zone (no new id for a revisit)", () => {
    // stage -> rows -> back -> stage again -> rows again
    const sigs = [area(0), area(0, 1), area(1), area(1, 2), area(2), area(2, 1), area(0, 2), area(0), area(1, 1), area(1)];
    assert.deepEqual(assignZones(sigs), [0, 0, 1, 1, 2, 2, 0, 0, 1, 1]);
  });
  test("a one-frame glance away folds back into the zone around it", () => {
    const sigs = [area(0), area(0, 1), area(3), area(0, 2), area(0, 3)];
    assert.deepEqual(assignZones(sigs), [0, 0, 0, 0, 0]);
  });
  test("a lone first or last frame joins its neighbour's zone", () => {
    assert.deepEqual(assignZones([area(3), area(0), area(0, 1)]), [0, 0, 0]);
    assert.deepEqual(assignZones([area(0), area(0, 1), area(3)]), [0, 0, 0]);
  });
  test("maxZones caps new zones; extra cuts join the nearest earlier zone", () => {
    const sigs = [area(0), area(0, 1), area(1), area(1, 1), area(2), area(2, 1), area(3), area(3, 1)];
    const ids = assignZones(sigs, { maxZones: 2 });
    assert.ok(Math.max(...ids) <= 1);
    assert.deepEqual(ids.slice(0, 4), [0, 0, 1, 1]);
  });
  test("ids are small integers from 0 with no gaps", () => {
    const ids = assignZones([area(0), area(0, 1), area(1), area(0), area(2), area(2, 1)]);
    const unique = [...new Set(ids)].sort((a, b) => a - b);
    assert.deepEqual(unique, unique.map((_, i) => i));
  });
  test("renumber and zone change indices", () => {
    assert.deepEqual(renumber([5, 5, 2, 5, 9]), [0, 0, 1, 0, 2]);
    assert.deepEqual(zoneChangeIndices([0, 0, 1, 1, 0, 2]), [0, 2, 4, 5]);
    assert.deepEqual(zoneChangeIndices([]), []);
  });
});

describe("zone ids on the request", () => {
  const frames = [0, 2, 4, 6].map((t) => ({ tSec: t, dataUrl: "data:image/jpeg;base64,AAAA" }));
  test("adds zoneId per frame when every frame was signed", () => {
    const out = withZoneIds(frames, [area(0), area(0, 1), area(1), area(1, 1)]);
    assert.deepEqual(out.map((f) => f.zoneId), [0, 0, 1, 1]);
    assert.deepEqual(out.map((f) => f.tSec), [0, 2, 4, 6]);
    assert.equal(frames[0].hasOwnProperty("zoneId"), false, "input frames are not mutated");
  });
  test("leaves frames without zoneId when any signature is missing or counts differ", () => {
    assert.equal(withZoneIds(frames, [area(0), null, area(1), area(1)]), frames);
    assert.equal(withZoneIds(frames, [area(0)]), frames);
    assert.ok(withZoneIds(frames, [area(0), null, area(1), area(1)]).every((f) => !("zoneId" in f)));
  });
});
