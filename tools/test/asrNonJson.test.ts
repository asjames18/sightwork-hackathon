/**
 * Offline test of the ASR caller's non-JSON 200 body
 * (src/lib/meta/transcribe.ts). A 200 body that is not JSON used to
 * throw a raw SyntaxError from res.json(), surfacing parser internals
 * instead of the caller and the cause. It now throws a plain named
 * Error("asr: response was not JSON"). It stays plain on purpose:
 * ASR bills by audio length and the duration lives inside the body
 * that failed to parse, so the failure cannot be priced and the
 * transcribe step's recordFailedCall records nothing — no spend is
 * invented, the same rule as Baseten's unpriceable non-JSON body.
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

test("a 200 with a non-JSON body throws a plain named error and records nothing", async () => {
  const caller = harness("{not json");
  let caught: unknown;
  try {
    await caller(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(!(caught instanceof AsrCallError), `expected plain error, got ${String(caught)}`);
  assert.equal((caught as Error).message, "asr: response was not JSON");
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-voice-transcribe-1.0", "transcribe", caught);
  assert.equal(tracker.records().length, 0);
  assert.equal(tracker.totals().spikeTotalUsd, 0);
});

test("a 200 with valid JSON still returns mapped turns at the same cost", async () => {
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
