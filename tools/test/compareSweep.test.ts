import { test } from "node:test";
import assert from "node:assert/strict";
import { SWEEP_MS, SWEEP_REACH, shouldSweep, sweepDone, sweepPos } from "../../src/lib/client/compareSweep";

test("sweepPos: starts and ends in the middle", () => {
  assert.equal(sweepPos(0), 50);
  assert.equal(sweepPos(SWEEP_MS), 50);
  assert.equal(sweepPos(SWEEP_MS + 500), 50);
  assert.equal(sweepPos(-10), 50);
});

test("sweepPos: goes out to the before side first, then across to the after side", () => {
  assert.equal(sweepPos(SWEEP_MS / 4), 50 + SWEEP_REACH);
  assert.equal(sweepPos(SWEEP_MS / 2), 50);
  assert.equal(sweepPos((3 * SWEEP_MS) / 4), 50 - SWEEP_REACH);
});

test("sweepPos: always a whole percent inside 0 to 100", () => {
  for (let t = 0; t <= SWEEP_MS; t += 37) {
    const p = sweepPos(t);
    assert.ok(Number.isInteger(p) && p >= 0 && p <= 100, `t=${t} p=${p}`);
  }
  assert.equal(sweepPos(250, 1000, 80), 100);
  assert.equal(sweepPos(750, 1000, 80), 0);
});

test("sweepPos: bad input stays in the middle", () => {
  assert.equal(sweepPos(Number.NaN), 50);
  assert.equal(sweepPos(100, 0), 50);
  assert.equal(sweepPos(100, Number.NaN), 50);
});

test("sweepDone: true only once the time is up", () => {
  assert.equal(sweepDone(0), false);
  assert.equal(sweepDone(SWEEP_MS - 1), false);
  assert.equal(sweepDone(SWEEP_MS), true);
});

test("shouldSweep: once, never with reduced motion, never after a touch", () => {
  assert.equal(shouldSweep({ reducedMotion: false, alreadyPlayed: false, touched: false }), true);
  assert.equal(shouldSweep({ reducedMotion: true, alreadyPlayed: false, touched: false }), false);
  assert.equal(shouldSweep({ reducedMotion: false, alreadyPlayed: true, touched: false }), false);
  assert.equal(shouldSweep({ reducedMotion: false, alreadyPlayed: false, touched: true }), false);
});
