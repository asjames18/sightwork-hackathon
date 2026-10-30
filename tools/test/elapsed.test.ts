import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceClock, formatClock, formatStepTime, spokenClock, startClock, stepDuration } from "@/lib/client/elapsed";

test("formatClock reads m:ss, h:mm:ss past an hour, and 0:00 for bad input", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(7_400), "0:07");
  assert.equal(formatClock(83_000), "1:23");
  assert.equal(formatClock(3_725_000), "1:02:05");
  assert.equal(formatClock(-5), "0:00");
  assert.equal(formatClock(Number.NaN), "0:00");
});

test("spokenClock uses words and singulars", () => {
  assert.equal(spokenClock(1_000), "1 second");
  assert.equal(spokenClock(45_000), "45 seconds");
  assert.equal(spokenClock(60_000), "1 minute");
  assert.equal(spokenClock(83_000), "1 minute 23 seconds");
});

test("formatStepTime hides sub-second steps and rounds", () => {
  assert.equal(formatStepTime(400), null);
  assert.equal(formatStepTime(Number.NaN), null);
  assert.equal(formatStepTime(1_000), "1 s");
  assert.equal(formatStepTime(12_400), "12 s");
  assert.equal(formatStepTime(60_000), "1 min");
  assert.equal(formatStepTime(65_200), "1 min 5 s");
});

test("advancing stamps every passed step, including a jump over skipped steps", () => {
  let c = startClock(1_000);
  c = advanceClock(c, 1, 4_000);
  c = advanceClock(c, 3, 10_000);
  assert.equal(stepDuration(c, 0), 3_000);
  assert.equal(stepDuration(c, 1), 6_000);
  assert.equal(stepDuration(c, 2), 0);
  assert.equal(stepDuration(c, 3), null);
});

test("the same step keeps the clock; going back or a restart starts a fresh one", () => {
  const c = advanceClock(startClock(0), 2, 5_000);
  assert.equal(advanceClock(c, 2, 9_000), c);
  const back = advanceClock(c, 0, 20_000);
  assert.deepEqual(back, { start: 20_000, marks: [], seen: 0 });
  const restarted = advanceClock(startClock(0), 0, 30_000, true);
  assert.equal(restarted.start, 30_000);
});
