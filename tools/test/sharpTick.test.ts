/** Sharper frames at the same ticks: candidate times near each tick and the keep-the-tick-unless-clearly-sharper rule. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseSharpTick, frameSharpness, isSoftTick, scoreSize, SCORE_SIDE, SHARP_MARGIN, SOFT_RATIO, tickCandidates } from "@/lib/client/sharpTick";

test("a tick gets itself first, then 0.3 s either side", () => {
  assert.deepEqual(tickCandidates(10, 60), [10, 9.7, 10.3]);
});

test("candidates stay 0.25 s inside the take and don't repeat", () => {
  assert.deepEqual(tickCandidates(0.25, 60), [0.25, 0.55]);
  assert.deepEqual(tickCandidates(0.4, 60), [0.4, 0.25, 0.7]);
  assert.deepEqual(tickCandidates(59.75, 60), [59.75, 59.45]);
  for (const t of tickCandidates(0.3, 0.6)) assert.ok(t >= 0.25 && t <= 0.35, String(t));
});

test("bad input: no spread or no length keeps just the tick; a non-number tick gives nothing", () => {
  assert.deepEqual(tickCandidates(5, 60, 0), [5]);
  assert.deepEqual(tickCandidates(5, NaN), [5]);
  assert.deepEqual(tickCandidates(NaN, 60), []);
});

test("the tick wins unless a neighbour is clearly sharper", () => {
  assert.equal(chooseSharpTick([100, 110, 90]), 0);
  assert.equal(chooseSharpTick([100, 100 * SHARP_MARGIN, 90]), 0);
  assert.equal(chooseSharpTick([100, 200, 150]), 1);
  assert.equal(chooseSharpTick([100, 150, 400]), 2);
});

test("unscored candidates are skipped; nothing scored keeps the tick; empty gives -1", () => {
  assert.equal(chooseSharpTick([NaN, 5, 9]), 2);
  assert.equal(chooseSharpTick([NaN, NaN]), 0);
  assert.equal(chooseSharpTick([]), -1);
});

test("adding candidates one by one never moves the pick back to an older one", () => {
  // The builder copies a candidate's pixels only when it becomes the pick, so this must hold.
  const runs = [
    [100, 200, 150],
    [100, 120, 300],
    [NaN, 3, 2, 8],
    [50, 10, 60, 58],
  ];
  for (const scores of runs) {
    let kept = -1;
    for (let i = 1; i <= scores.length; i++) {
      const pick = chooseSharpTick(scores.slice(0, i));
      if (pick !== kept) assert.equal(pick, i - 1, `run ${scores.join(",")} step ${i}`);
      kept = pick;
    }
  }
});

test("only soft ticks are nudged: under 60% of the median of earlier ticks", () => {
  assert.equal(SOFT_RATIO, 0.6);
  const history = [100, 120, 80, 110];
  assert.equal(isSoftTick(100, history), false);
  assert.equal(isSoftTick(63, history), false);
  assert.equal(isSoftTick(62, history), true);
  assert.equal(isSoftTick(10, [100, 300, 50]), true);
  assert.equal(isSoftTick(70, [100, 300, 50]), false);
});

test("the first ticks, unscored ticks and unscored history are always nudged", () => {
  assert.equal(isSoftTick(500, []), true);
  assert.equal(isSoftTick(500, [10, 10]), true);
  assert.equal(isSoftTick(NaN, [100, 100, 100]), true);
  assert.equal(isSoftTick(500, [NaN, NaN, 100, 100]), true);
});

test("score copies are small and keep the shape", () => {
  assert.deepEqual(scoreSize(1024, 576), { w: SCORE_SIDE, h: 90 });
  assert.deepEqual(scoreSize(576, 1024), { w: 90, h: SCORE_SIDE });
  assert.deepEqual(scoreSize(100, 50), { w: 100, h: 50 });
});

test("a smeared frame scores lower than the same frame in focus", () => {
  const S = 32;
  const crisp = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = (x >> 2) % 2 === 0 ? 255 : 0;
      crisp.set([v, v, v, 255], (y * S + x) * 4);
    }
  // Horizontal motion blur: average 7 pixels along the row.
  const smeared = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += crisp[(y * S + Math.min(S - 1, Math.max(0, x + k))) * 4];
      const v = Math.round(sum / 7);
      smeared.set([v, v, v, 255], (y * S + x) * 4);
    }
  assert.ok(frameSharpness(crisp, S, S) > frameSharpness(smeared, S, S) * SHARP_MARGIN);
});

test("the builder sends one frame per tick and still samples with pickFrameTimes", async () => {
  const { readFile } = await import("node:fs/promises");
  const build = await readFile(new URL("../../src/lib/client/buildPlanRequest.ts", import.meta.url), "utf8");
  assert.ok(build.includes("pickFrameTimes(durationSec"));
  assert.ok(build.includes("tickCandidates(t, durationSec)"));
  assert.ok(!build.includes("planSampleWindows"));
});
