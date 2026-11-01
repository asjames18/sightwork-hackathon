/** Recorder take meter on the live preview (recorder.ts takeMeter). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { takeMeter } from "@/lib/client/recorder";
import { durationRulesFor } from "@/lib/client/duration";

const medium = durationRulesFor("medium"); // aim 60-90 s, warn past 95 s, stops at 120 s
const large = durationRulesFor("large"); // aim 90-180 s, warn past 150 s, stops at 180 s

test("before the aim range: keep going, white fill, aim band marked on the cap scale", () => {
  const m = takeMeter(30, medium);
  assert.equal(m.zone, "early");
  assert.equal(m.label, "Keep going");
  assert.equal(m.fillPct, 25);
  assert.equal(m.aimStartPct, 50);
  assert.equal(m.aimEndPct, 75);
});

test("inside the aim range, and up to the wrap-up point, reads as a good length", () => {
  assert.equal(takeMeter(60, medium).zone, "aim");
  assert.equal(takeMeter(95, medium).zone, "aim");
  assert.equal(takeMeter(95, medium).label, "Good length");
});

test("past the wrap-up point says wrap up", () => {
  const m = takeMeter(100, medium);
  assert.equal(m.zone, "long");
  assert.equal(m.label, "Wrap up");
});

test("the aim band stops at the wrap-up point when that comes before the aim's end", () => {
  const m = takeMeter(10, large);
  assert.equal(m.aimStartPct, 50);
  assert.ok(Math.abs(m.aimEndPct - 83.3) < 0.01, String(m.aimEndPct));
});

test("fill is clamped to 0..100 and bad input reads as zero", () => {
  assert.equal(takeMeter(500, medium).fillPct, 100);
  assert.equal(takeMeter(-3, medium).fillPct, 0);
  assert.equal(takeMeter(Number.NaN, medium).fillPct, 0);
  assert.equal(takeMeter(Number.NaN, medium).zone, "early");
});

test("screen reader text names the time, the cap, the state and the aim range", () => {
  assert.equal(takeMeter(70, medium).valueText, "1:10 of 2:00. Good length. Aim for 60 to 90 seconds.");
});

test("defaults to medium when no rules are passed", () => {
  assert.deepEqual(takeMeter(30), takeMeter(30, medium));
});
