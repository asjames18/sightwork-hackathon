import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_GAIN, TARGET_PEAK, narrationGain, normalizeNarration, referencePeak } from "@/lib/client/narrationLevel";

/** One second of a 220 Hz tone at the given amplitude, 16 kHz. */
function tone(amp: number, n = 16000): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / 16000));
}
const maxAbs = (s: Float32Array) => s.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

test("quiet narration is brought up to the target level", () => {
  const quiet = tone(0.07); // about -23 dBFS, a phone at arm's length
  const out = normalizeNarration(quiet);
  assert.ok(Math.abs(maxAbs(out) - TARGET_PEAK) < 0.01, `peak ${maxAbs(out)}`);
  assert.equal(out.length, quiet.length);
});

test("a take that is already loud is left untouched (same array, never turned down)", () => {
  const loud = tone(0.9);
  assert.equal(narrationGain(loud), 1);
  assert.equal(normalizeNarration(loud), loud);
});

test("gain is capped so room tone isn't blown up", () => {
  const roomTone = tone(0.005);
  assert.equal(narrationGain(roomTone), MAX_GAIN);
  assert.ok(maxAbs(normalizeNarration(roomTone)) < 0.1);
});

test("one loud click doesn't set the level, and it clamps instead of wrapping", () => {
  const s = tone(0.05);
  s[100] = 1;
  s[200] = -1;
  const out = normalizeNarration(s);
  assert.ok(narrationGain(s) > 10, `gain ${narrationGain(s)}`);
  assert.equal(out[100], 1);
  assert.equal(out[200], -1);
  for (const x of out) assert.ok(x >= -1 && x <= 1);
});

test("empty and all-zero takes are left alone", () => {
  assert.equal(referencePeak(new Float32Array(0)), 0);
  assert.equal(narrationGain(new Float32Array(0)), 1);
  const zeros = new Float32Array(100);
  assert.equal(normalizeNarration(zeros), zeros);
});
