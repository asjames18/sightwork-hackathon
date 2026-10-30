import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUIET_HINT_SEC,
  QUIET_LEVEL,
  isTooQuiet,
  levelFromSamples,
  nextQuietSince,
  smoothLevel,
} from "@/lib/client/micLevel";
import { canKeepScreenOn } from "@/lib/client/wakeLock";

test("silence reads 0 and an empty frame reads 0", () => {
  assert.equal(levelFromSamples(new Uint8Array(512).fill(128)), 0);
  assert.equal(levelFromSamples(new Uint8Array(0)), 0);
});

test("louder samples read higher, capped at 1", () => {
  const soft = Uint8Array.from({ length: 512 }, (_, i) => (i % 2 ? 132 : 124));
  const loud = Uint8Array.from({ length: 512 }, (_, i) => (i % 2 ? 180 : 76));
  const clipped = Uint8Array.from({ length: 512 }, (_, i) => (i % 2 ? 255 : 0));
  const a = levelFromSamples(soft);
  const b = levelFromSamples(loud);
  assert.ok(a > 0 && a < QUIET_LEVEL * 4, `soft ${a}`);
  assert.ok(b > a, `loud ${b} > soft ${a}`);
  assert.equal(levelFromSamples(clipped), 1);
});

test("smoothing rises fast and falls slowly, staying in 0..1", () => {
  const up = smoothLevel(0, 1);
  const down = smoothLevel(1, 0);
  assert.ok(up >= 0.5, `up ${up}`);
  assert.ok(down >= 0.8, `down ${down}`);
  assert.equal(smoothLevel(0.5, 0.5), 0.5);
  assert.ok(smoothLevel(0, 2) <= 1);
});

test("quiet tracking: starts on the first quiet reading, resets on sound", () => {
  let since: number | null = null;
  since = nextQuietSince(since, 0, 10);
  assert.equal(since, 10);
  since = nextQuietSince(since, 0.01, 12);
  assert.equal(since, 10, "keeps the first quiet time");
  assert.equal(isTooQuiet(since, 10 + QUIET_HINT_SEC - 0.1), false);
  assert.equal(isTooQuiet(since, 10 + QUIET_HINT_SEC), true);
  since = nextQuietSince(since, QUIET_LEVEL, 16);
  assert.equal(since, null, "sound at the threshold counts as heard");
  assert.equal(isTooQuiet(since, 100), false);
});

test("wake lock support is detected only when navigator.wakeLock.request exists", () => {
  assert.equal(canKeepScreenOn(undefined), false);
  assert.equal(canKeepScreenOn({}), false);
  assert.equal(canKeepScreenOn({ wakeLock: {} }), false);
  assert.equal(canKeepScreenOn({ wakeLock: { request: async () => ({ release: async () => {} }) } }), true);
});

test("a suspended audio context gives no reading, so it can't count as quiet", async () => {
  const { levelIfRunning } = await import("@/lib/client/micLevel");
  let reads = 0;
  const read = () => {
    reads++;
    return 0.5;
  };
  assert.equal(levelIfRunning("suspended", read), null);
  assert.equal(levelIfRunning("interrupted", read), null);
  assert.equal(levelIfRunning("closed", read), null);
  assert.equal(reads, 0, "a suspended analyser isn't read at all");
  assert.equal(levelIfRunning("running", read), 0.5);
  assert.equal(levelIfRunning(undefined, read), 0.5);
});
