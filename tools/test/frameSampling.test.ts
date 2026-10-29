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
