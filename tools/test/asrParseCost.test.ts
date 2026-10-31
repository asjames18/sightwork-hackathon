/**
 * Offline test of the ASR caller's cost-carrying parse failures
 * (src/lib/meta/transcribe.ts). A 200 response whose turns do not
 * parse still spent the call (ASR bills by audio length): when the
 * response carries a usable audioDurationMs, the failure throws
 * AsrCallError with costUsd/latencyMs (mirroring SamCallError) so
 * the transcribe step's recordFailedCall can record it instead of
 * dropping the spend from the route total. Without a usable
 * duration the failure cannot be priced and keeps the plain error.
 * Fake fetch only; no network, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AsrCallError, createAsrTranscribeCaller } from "@/lib/meta/transcribe";
import { createUsageTracker, recordFailedCall } from "@/lib/pipeline/usage";

/** A tiny PCM WAV: 44-byte header plus a few silent samples. */
function wav(): string {
  const data = Buffer.alloc(32);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]).toString("base64");
}

const AUDIO = wav();

function harness(body: string) {
  const fetchImpl = (async () =>
    new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  return createAsrTranscribeCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
}

const req = {
  model: "muse-voice-transcribe-1.0",
  mode: "standard" as const,
  audioWavBase64: AUDIO,
  keywordBias: [] as string[],
};

async function expectAsrCostError(
  caller: ReturnType<typeof createAsrTranscribeCaller>,
  pattern: RegExp,
  expectedCost: number,
): Promise<AsrCallError> {
  let caught: unknown;
  try {
    await caller(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof AsrCallError, `expected AsrCallError, got ${String(caught)}`);
  assert.match((caught as Error).message, pattern);
  assert.equal((caught as AsrCallError).name, "AsrCallError");
  assert.equal((caught as AsrCallError).costUsd, expectedCost);
  assert.ok(
    Number.isFinite((caught as AsrCallError).latencyMs) &&
      (caught as AsrCallError).latencyMs >= 0,
  );
  return caught as AsrCallError;
}

test("turns not an array throws AsrCallError carrying the priced cost", async () => {
  const caller = harness(JSON.stringify({ audioDurationMs: 42000, turns: "nope" }));
  const caught = await expectAsrCostError(
    caller,
    /^asr: response turns is not an array$/,
    (42 / 3600) * 0.18,
  );
  // The step's recordFailedCall path records it on the tracker.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-voice-transcribe-1.0", "transcribe", caught);
  assert.equal(tracker.records().length, 1);
  assert.equal(tracker.totals().spikeTotalUsd, (42 / 3600) * 0.18);
});

test("a malformed turn throws AsrCallError with the parse message verbatim", async () => {
  const caller = harness(
    JSON.stringify({
      audioDurationMs: 36000,
      turns: [{ startMs: 0, transcript: "hello" }],
    }),
  );
  const caught = await expectAsrCostError(
    caller,
    /^asr: turn 0 has no valid endMs$/,
    (36 / 3600) * 0.18,
  );
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-voice-transcribe-1.0", "transcribe", caught);
  assert.equal(tracker.records().length, 1);
});

test("an unpriceable parse failure keeps the plain error and records nothing", async () => {
  const caller = harness(JSON.stringify({ turns: "nope" }));
  let caught: unknown;
  try {
    await caller(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(!(caught instanceof AsrCallError), `expected plain error, got ${String(caught)}`);
  assert.match((caught as Error).message, /^asr: response turns is not an array$/);
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-voice-transcribe-1.0", "transcribe", caught);
  assert.equal(tracker.records().length, 0);
  assert.equal(tracker.totals().spikeTotalUsd, 0);
});

test("a negative duration cannot be priced, so the parse failure stays plain", async () => {
  const caller = harness(JSON.stringify({ audioDurationMs: -5000, turns: "nope" }));
  let caught: unknown;
  try {
    await caller(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(!(caught instanceof AsrCallError), `expected plain error, got ${String(caught)}`);
  assert.match((caught as Error).message, /^asr: response turns is not an array$/);
});

test("valid turns still return mapped turns at the same cost", async () => {
  const caller = harness(
    JSON.stringify({
      audioDurationMs: 42000,
      turns: [{ turnId: "t1", startMs: 0, endMs: 42000, transcript: "hello" }],
    }),
  );
  const res = await caller(req);
  assert.deepEqual(res.turns, [{ startSec: 0, endSec: 42, text: "hello" }]);
  assert.equal(res.costUsd, (42 / 3600) * 0.18);
});
