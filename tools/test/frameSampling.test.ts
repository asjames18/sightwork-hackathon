/** Proposal C prep (longer takes): sharpest-frame-per-window sampling. Not wired yet; pure logic. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pickSharpest, planSampleWindows, sharpness } from "@/lib/client/frameSampling";

const S = 32;

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

describe("longer-take sampling prep (not wired)", () => {
  test("windows cover the take, one per ~2.5 s, capped at maxFrames", () => {
    const w = planSampleWindows(90);
    assert.equal(w.length, 36);
    assert.equal(w[0].startSec, 0.25);
    assert.equal(w.at(-1)!.endSec, 89.75);
    for (const win of w) {
      assert.equal(win.candidates.length, 3);
      for (const c of win.candidates) assert.ok(c >= win.startSec && c <= win.endSec);
    }
    assert.equal(planSampleWindows(300).length, 48);
    assert.deepEqual(planSampleWindows(0), []);
    assert.deepEqual(planSampleWindows(NaN), []);
  });
  test("sharpness: crisp edges beat a flat or blurred frame", () => {
    const crisp = image((x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
    const soft = image((x) => [x * 8, x * 8, x * 8]);
    const flat = image(() => [128, 128, 128]);
    assert.equal(sharpness(flat, S, S), 0);
    assert.ok(sharpness(crisp, S, S) > sharpness(soft, S, S));
    assert.equal(pickSharpest([sharpness(soft, S, S), sharpness(crisp, S, S), sharpness(flat, S, S)]), 1);
    assert.equal(pickSharpest([]), -1);
  });
});

/** 3x3 box blur, for a realistic soft version of an image. */
function blur(d: Uint8ClampedArray, w = S, h = S): Uint8ClampedArray {
  const o = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            s += d[(yy * w + xx) * 4 + c];
            n++;
          }
        o[(y * w + x) * 4 + c] = Math.round(s / n);
      }
  return o;
}

describe("longer-take sampling prep, more cases (still not wired)", () => {
  test("windows are contiguous, in order, and candidates are evenly spread inside each", () => {
    for (const dur of [5, 12.3, 61, 95, 150, 300]) {
      const w = planSampleWindows(dur);
      assert.ok(w.length >= 1 && w.length <= 48);
      for (let i = 1; i < w.length; i++) assert.ok(Math.abs(w[i].startSec - w[i - 1].endSec) <= 0.011, `gap at ${dur}s window ${i}`);
      for (const win of w) for (let j = 1; j < win.candidates.length; j++) assert.ok(win.candidates[j] > win.candidates[j - 1]);
    }
  });
  test("options: windowSec, maxFrames and candidatesPerWindow are respected; bad input gives []", () => {
    assert.equal(planSampleWindows(60, 48, 5).length, 12);
    assert.equal(planSampleWindows(60, 10).length, 10);
    assert.ok(planSampleWindows(60, 48, 2.5, 1).every((w) => w.candidates.length === 1));
    assert.deepEqual(planSampleWindows(60, 0), []);
    assert.deepEqual(planSampleWindows(60, 48, 2.5, 0), []);
    assert.deepEqual(planSampleWindows(-3), []);
    assert.deepEqual(planSampleWindows(Infinity), []);
  });
  test("a very short take still gets one window with seeks inside the clip", () => {
    const w = planSampleWindows(0.3);
    assert.equal(w.length, 1);
    for (const c of w[0].candidates) assert.ok(c >= 0 && c <= 0.3);
  });
  test("150 s at the current block: 48 windows, about 3.1 s each, all inside the take", () => {
    const w = planSampleWindows(150);
    assert.equal(w.length, 48);
    assert.ok(Math.abs(w[0].endSec - w[0].startSec - 3.115) < 0.02);
    assert.ok(w.every((x) => x.candidates.every((c) => c > 0 && c < 150)));
  });
  test("sharpness: a blurred copy scores lower than the original; tiny or short buffers score 0", () => {
    const edges = image((x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? [230, 220, 210] : [20, 30, 40]));
    assert.ok(sharpness(edges, S, S) > 2 * sharpness(blur(edges), S, S));
    assert.ok(sharpness(blur(edges), S, S) > sharpness(blur(blur(edges)), S, S));
    assert.equal(sharpness(new Uint8ClampedArray(2 * 2 * 4), 2, 2), 0);
    assert.equal(sharpness(new Uint8ClampedArray(10), S, S), 0);
  });
  test("pickSharpest skips NaN and keeps the first on a tie", () => {
    assert.equal(pickSharpest([NaN, 3, 3, 1]), 1);
    assert.equal(pickSharpest([NaN, NaN]), -1);
  });
  test("stays unwired: buildPlanRequest still samples with pickFrameTimes and duration limits are 95/150", async () => {
    const { readFile } = await import("node:fs/promises");
    const build = await readFile(new URL("../../src/lib/client/buildPlanRequest.ts", import.meta.url), "utf8");
    assert.ok(!build.includes("frameSampling"));
    const { checkDuration } = await import("@/lib/client/duration");
    assert.equal(checkDuration(95).kind, "ok");
    assert.equal(checkDuration(96).kind, "warn");
    assert.equal(checkDuration(150).kind, "warn");
    assert.equal(checkDuration(151).kind, "block");
  });
});
