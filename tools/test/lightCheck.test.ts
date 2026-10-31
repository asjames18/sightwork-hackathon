/** Light check on the upload screen: a soft warning for a take too dark to show damage. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLANK_PREVIEW_MESSAGE,
  DARK_TAKE_MESSAGE,
  DIM_MEAN,
  LIGHT_SAMPLES,
  lightMessage,
  lightSampleTimes,
  lightVerdict,
} from "@/lib/client/lightCheck";
import { lumaStats } from "@/lib/client/blankTake";

const frame = (mean: number, spread = 30) => ({ mean, spread });

test("sample times are evenly spread and stay inside the video", () => {
  const t = lightSampleTimes(60);
  assert.equal(t.length, LIGHT_SAMPLES);
  assert.deepEqual(t, [5, 15, 25, 35, 45, 55]);
  assert.ok(t.every((x) => x > 0 && x < 60));
  assert.deepEqual(lightSampleTimes(0), []);
  assert.deepEqual(lightSampleTimes(Number.NaN), []);
  assert.deepEqual(lightSampleTimes(10, 0), []);
});

test("a normally lit walk is ok, even with one dark corner", () => {
  assert.equal(lightVerdict([frame(120), frame(95), frame(20), frame(110), frame(88), frame(100)]), "ok");
});

test("a dim stage like the real sanctuary walks is ok", () => {
  // Darkest frames of real phone walkthroughs measured about 37; most frames 70 and up.
  assert.equal(lightVerdict([frame(90), frame(85), frame(70), frame(75), frame(60), frame(37)]), "ok");
});

test("a walk dark for most of its length is called dark", () => {
  assert.equal(lightVerdict([frame(15), frame(20), frame(22), frame(90), frame(18), frame(12)]), "dark");
  assert.equal(lightVerdict([frame(DIM_MEAN - 1), frame(DIM_MEAN - 1), frame(DIM_MEAN - 1)]), "dark");
  assert.equal(lightVerdict([frame(DIM_MEAN), frame(DIM_MEAN), frame(DIM_MEAN)]), "ok");
});

test("just under the share is ok, at the share is dark", () => {
  // 3 of 6 dim = 50%: ok. 4 of 6 = 67%: dark.
  assert.equal(lightVerdict([frame(10), frame(10), frame(10), frame(90), frame(90), frame(90)]), "ok");
  assert.equal(lightVerdict([frame(10), frame(10), frame(10), frame(10), frame(90), frame(90)]), "dark");
});

test("every frame flat or black is blank, not just dark", () => {
  assert.equal(lightVerdict([frame(0, 0), frame(2, 1), frame(1, 0)]), "blank");
});

test("frames that couldn't be read are left out; none read means no warning", () => {
  assert.equal(lightVerdict([]), "ok");
  assert.equal(lightVerdict([null, null]), "ok");
  assert.equal(lightVerdict([null, frame(15), frame(20), null]), "dark");
});

test("measured from real pixels: a dim grey frame is dark", () => {
  const side = 8;
  const px = new Uint8ClampedArray(side * side * 4);
  for (let i = 0; i < side * side; i++) {
    const v = i % 2 ? 30 : 10;
    px.set([v, v, v, 255], i * 4);
  }
  const s = lumaStats(px, side, side);
  assert.ok(s);
  assert.equal(lightVerdict([s, s, s]), "dark");
});

test("messages: plain words, a way forward, and nothing for ok", () => {
  assert.equal(lightMessage("ok"), null);
  assert.equal(lightMessage("dark"), DARK_TAKE_MESSAGE);
  assert.equal(lightMessage("blank"), BLANK_PREVIEW_MESSAGE);
  assert.match(DARK_TAKE_MESSAGE, /turn the lights on/);
  assert.match(DARK_TAKE_MESSAGE, /still go ahead/);
});
