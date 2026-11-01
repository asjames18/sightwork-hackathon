/**
 * Offline test of the transcribe step's abort-signal wiring
 * (src/lib/meta/transcribe.ts, src/lib/pipeline/transcribe.ts,
 * src/lib/pipeline/runPlan.ts). Stopping a run used to stop only
 * before the next pipeline step: the in-flight ASR call ran to
 * completion and billed, because no signal reached its fetch, and
 * the cleanup call had no signal either. The ASR caller now
 * passes its request signal to the fetch and throws AbortError
 * before any fetch when already aborted; the transcribe step
 * forwards its dep signal to both the ASR and cleanup calls;
 * and runPlan hands the route's request signal to the transcribe
 * deps, matching the reason, cost, review, and picturing legs.
 * Fake fetch/callers only; no network, no key, no paid call.
 * Omitting the signal behaves exactly as before at every level.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAsrTranscribeCaller } from "@/lib/meta/transcribe";
import {
  runTranscribe,
  type CleanupCaller,
  type TranscribeCaller,
} from "@/lib/pipeline/transcribe";
import {
  createUsageTracker,
  type UsageTracker,
} from "@/lib/pipeline/usage";

/** Minimal mono s16le 16 kHz WAV (44-byte header, no samples), base64. */
function wavBase64(): string {
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(0, 40);
  return buf.toString("base64");
}

const AUDIO = wavBase64();
const TURNS = [{ startSec: 0, text: "leak under sink" }];

function tracker(): UsageTracker {
  return createUsageTracker();
}

test("step forwards a live signal to the ASR caller", async () => {
  const controller = new AbortController();
  let seen: unknown;
  const callTranscribe: TranscribeCaller = async (req) => {
    seen = req.signal;
    return { turns: TURNS, latencyMs: 10, costUsd: 0.01 };
  };
  const out = await runTranscribe(
    { audioWavBase64: AUDIO },
    { callTranscribe, tracker: tracker(), signal: controller.signal },
  );
  assert.equal(seen, controller.signal);
  assert.equal(out.transcript, "[0.0] leak under sink");
});

test("step without a signal passes none to the ASR caller", async () => {
  let seen: unknown = "unset";
  const callTranscribe: TranscribeCaller = async (req) => {
    seen = req.signal;
    return { turns: TURNS, latencyMs: 10, costUsd: 0.01 };
  };
  await runTranscribe(
    { audioWavBase64: AUDIO },
    { callTranscribe, tracker: tracker() },
  );
  assert.equal(seen, undefined);
});

test("step forwards a live signal to the cleanup caller", async () => {
  const controller = new AbortController();
  let seen: unknown;
  const callTranscribe: TranscribeCaller = async () => ({
    turns: TURNS,
    latencyMs: 10,
    costUsd: 0.01,
  });
  const callCleanup: CleanupCaller = async (req) => {
    seen = req.signal;
    return { text: "[0.0] leak under sink", latencyMs: 5, costUsd: 0.001 };
  };
  const out = await runTranscribe(
    { audioWavBase64: AUDIO },
    {
      callTranscribe,
      tracker: tracker(),
      signal: controller.signal,
      cleanupPrompt: "{{raw_turns}}",
      callCleanup,
    },
  );
  assert.equal(seen, controller.signal);
  assert.equal(out.transcript, "[0.0] leak under sink");
});

test("ASR caller with an already-aborted signal never fetches", async () => {
  let fetches = 0;
  const caller = createAsrTranscribeCaller({
    apiKey: "test-key-never-sent",
    fetchImpl: (async () => {
      fetches++;
      return new Response("{}", { status: 200 });
    }) as typeof fetch,
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    caller({
      model: "muse-voice-transcribe-1.0",
      mode: "standard",
      audioWavBase64: AUDIO,
      keywordBias: [],
      signal: controller.signal,
    }),
    (err: unknown) => err instanceof Error && err.name === "AbortError",
  );
  assert.equal(fetches, 0);
});

test("ASR caller passes a live signal to its fetch", async () => {
  const controller = new AbortController();
  let seen: unknown = "unset";
  const caller = createAsrTranscribeCaller({
    apiKey: "test-key-never-sent",
    fetchImpl: (async (_url: unknown, init: unknown) => {
      seen = (init as { signal?: unknown }).signal;
      return new Response(
        JSON.stringify({
          turns: [{ startMs: 0, endMs: 1000, transcript: "leak under sink" }],
          audioDurationMs: 5000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
  });
  const res = await caller({
    model: "muse-voice-transcribe-1.0",
    mode: "standard",
    audioWavBase64: AUDIO,
    keywordBias: [],
    signal: controller.signal,
  });
  assert.equal(seen, controller.signal);
  assert.equal(res.turns.length, 1);
  assert.equal(res.turns[0].text, "leak under sink");
});
