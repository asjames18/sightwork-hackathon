import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK_TAKE_MESSAGE, isBlankFrame, isBlankTake, lumaStats } from "@/lib/client/blankTake";

const W = 8;
/** An 8x8 RGBA buffer filled by fn(x, y) -> grey level. */
function frame(fn: (x: number, y: number) => number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const g = fn(x, y);
      px[o] = px[o + 1] = px[o + 2] = g;
      px[o + 3] = 255;
    }
  return px;
}
const stats = (fn: (x: number, y: number) => number) => lumaStats(frame(fn), W, W)!;

const black = stats(() => 0);
const flatGrey = stats(() => 128); // lens covered by a grey case, or a flat wall filling the shot
const darkNoise = stats((x, y) => ((x + y) % 2 ? 6 : 2)); // pocket: sensor noise in the dark
const room = stats((x, y) => 40 + x * 20 + y * 6); // a real, lit scene with edges and gradients
const dimRoom = stats((x) => (x < 4 ? 14 : 60)); // a dim sanctuary still has structure

test("lumaStats: mean and spread of the grey level; null for a short buffer", () => {
  assert.equal(black.mean, 0);
  assert.equal(black.spread, 0);
  assert.equal(Math.round(flatGrey.mean), 128);
  assert.ok(flatGrey.spread < 0.01);
  assert.ok(room.spread > 30);
  assert.equal(lumaStats(new Uint8ClampedArray(10), W, W), null);
  assert.equal(lumaStats(new Uint8ClampedArray(0), 0, 0), null);
});

test("isBlankFrame: flat or near black is blank; a lit or dim real scene is not", () => {
  assert.equal(isBlankFrame(black), true);
  assert.equal(isBlankFrame(flatGrey), true);
  assert.equal(isBlankFrame(darkNoise), true);
  assert.equal(isBlankFrame(room), false);
  assert.equal(isBlankFrame(dimRoom), false);
});

test("isBlankTake: only when every measured frame is blank", () => {
  assert.equal(isBlankTake([black, black, flatGrey, darkNoise]), true);
  assert.equal(isBlankTake([black, black, room]), false, "one real frame is enough");
  assert.equal(isBlankTake([black, null, black]), true, "unreadable frames are skipped");
  assert.equal(isBlankTake([null, null]), false, "nothing measured: let it through");
  assert.equal(isBlankTake([]), false);
});

test("the message tells the person what to do", () => {
  assert.match(BLANK_TAKE_MESSAGE, /blank or black/);
  assert.match(BLANK_TAKE_MESSAGE, /film it again/);
});
