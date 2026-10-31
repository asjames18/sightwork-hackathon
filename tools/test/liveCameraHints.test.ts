import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLUR_HINT_SEC,
  DARK_HINT_SEC,
  HINT_HOLD_SEC,
  HINT_SIDE,
  INITIAL_LIVE_HINT_STATE,
  LIVE_DIM_MEAN,
  LIVE_HINT_TEXT,
  SHARP_HISTORY,
  hintCanvasSize,
  nextLiveHintState,
  type LiveHintState,
  type LiveSample,
} from "../../src/lib/client/liveCameraHints";

const BRIGHT_SHARP: LiveSample = { mean: 110, sharp: 400 };
const BRIGHT_BLUR: LiveSample = { mean: 110, sharp: 60 };
const DARK: LiveSample = { mean: LIVE_DIM_MEAN - 10, sharp: 20 };

/** Feeds samples every 0.5 s starting at t0; returns the final state and the time of the last sample. */
function run(samples: (LiveSample | null)[], start: LiveHintState = INITIAL_LIVE_HINT_STATE, t0 = 0) {
  let s = start;
  let t = t0;
  for (const x of samples) {
    s = nextLiveHintState(s, x, t);
    t += 0.5;
  }
  return { s, t: t - 0.5 };
}
const times = (n: number, x: LiveSample | null) => Array.from({ length: n }, () => x);

test("a steady bright, sharp take never shows a hint", () => {
  const { s } = run(times(40, BRIGHT_SHARP));
  assert.equal(s.shown, null);
});

test("dark for under DARK_HINT_SEC says nothing; past it the dark hint shows", () => {
  const short = run([...times(4, BRIGHT_SHARP), ...times(DARK_HINT_SEC * 2, DARK)]);
  assert.equal(short.s.shown, null, "2.5 s of dark is a doorway, not a dark room");
  const long = run([...times(4, BRIGHT_SHARP), ...times(DARK_HINT_SEC * 2 + 1, DARK)]);
  assert.equal(long.s.shown, "dark");
});

test("blur needs a learned baseline first, then BLUR_HINT_SEC of soft frames", () => {
  // Soft from the very start: nothing to compare against, so no blur hint.
  assert.equal(run(times(3, BRIGHT_BLUR)).s.shown, null);
  const quickTurn = run([...times(6, BRIGHT_SHARP), ...times(BLUR_HINT_SEC * 2, BRIGHT_BLUR)]);
  assert.equal(quickTurn.s.shown, null, "a 1 s turn is fine");
  const pan = run([...times(6, BRIGHT_SHARP), ...times(BLUR_HINT_SEC * 2 + 1, BRIGHT_BLUR)]);
  assert.equal(pan.s.shown, "blur");
});

test("dark wins over blur, and dark frames don't teach the sharp baseline", () => {
  const { s } = run([...times(6, BRIGHT_SHARP), ...times(10, DARK)]);
  assert.equal(s.shown, "dark");
  assert.equal(s.sharpHistory.length, 6);
  assert.equal(s.blurSince, null);
});

test("the hint stays up HINT_HOLD_SEC after the picture recovers, then clears", () => {
  const dark = run([...times(4, BRIGHT_SHARP), ...times(10, DARK)]);
  assert.equal(dark.s.shown, "dark");
  let s = nextLiveHintState(dark.s, BRIGHT_SHARP, dark.t + 0.5);
  assert.equal(s.shown, "dark", "held");
  s = nextLiveHintState(s, BRIGHT_SHARP, dark.t + HINT_HOLD_SEC + 0.1);
  assert.equal(s.shown, null, "cleared after the hold");
  assert.equal(s.darkSince, null);
});

test("an unreadable preview (null or NaN) changes nothing", () => {
  const { s } = run(times(6, BRIGHT_SHARP));
  assert.equal(nextLiveHintState(s, null, 10), s);
  assert.equal(nextLiveHintState(s, { mean: NaN, sharp: 1 }, 10), s);
});

test("the sharp baseline keeps only the last SHARP_HISTORY bright samples", () => {
  const { s } = run(times(SHARP_HISTORY + 10, BRIGHT_SHARP));
  assert.equal(s.sharpHistory.length, SHARP_HISTORY);
});

test("hintCanvasSize keeps aspect, caps the long side, never upscales", () => {
  assert.deepEqual(hintCanvasSize(1920, 1080), { width: HINT_SIDE, height: Math.round((1080 * HINT_SIDE) / 1920) });
  assert.deepEqual(hintCanvasSize(1080, 1920), { width: Math.round((1080 * HINT_SIDE) / 1920), height: HINT_SIDE });
  assert.deepEqual(hintCanvasSize(80, 60), { width: 80, height: 60 });
  assert.equal(hintCanvasSize(0, 1080), null);
});

test("hint lines are plain and say what to do", () => {
  assert.match(LIVE_HINT_TEXT.dark, /light/i);
  assert.match(LIVE_HINT_TEXT.blur, /slow/i);
});
