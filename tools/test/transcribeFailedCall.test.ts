/**
 * runTranscribe records a billed-but-failed call, then rethrows
 * (offline): the ASR call and the optional Spark cleanup call each
 * land on the tracker before the throw propagates, so runPlan's
 * continue-without-narration path still counts the spend; a plain
 * throw records nothing, and a tracker throw (spike cap) replaces
 * the call error as a spending stop. No live calls; every model
 * caller is a stub and fetch throws.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  CLEANUP_MODEL,
  TRANSCRIBE_MODEL,
  runTranscribe,
  type TranscribeDeps,
} from "@/lib/pipeline/transcribe";
import { createUsageTracker } from "@/lib/pipeline/usage";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("transcribeFailedCall.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

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

/** A caller throw that still spent money, like MetaCallError. */
function billedThrow(costUsd: number, latencyMs: number): Error {
  const err = new Error("meta: response text was not JSON");
  Object.assign(err, { costUsd, latencyMs });
  return err;
}

const AUDIO = wav();

describe("runTranscribe failed-call spend", () => {
  test("a billed ASR throw is recorded, then rethrown", async () => {
    const tracker = createUsageTracker();
    const deps: TranscribeDeps = {
      tracker,
      callTranscribe: (async () => {
        throw billedThrow(0.12, 300);
      }) as TranscribeDeps["callTranscribe"],
    };
    await assert.rejects(
      () => runTranscribe({ audioWavBase64: AUDIO }, deps),
      { message: "meta: response text was not JSON" },
    );
    assert.equal(tracker.records().length, 1);
    const [rec] = tracker.records();
    assert.equal(rec.model, TRANSCRIBE_MODEL);
    assert.equal(rec.step, "transcribe");
    assert.equal(rec.costUsd, 0.12);
    assert.equal(rec.latencyMs, 300);
    assert.equal(tracker.totals().spikeTotalUsd, 0.12);
  });

  test("a plain ASR throw records nothing, still rethrown", async () => {
    const tracker = createUsageTracker();
    const deps: TranscribeDeps = {
      tracker,
      callTranscribe: (async () => {
        throw new Error("network down");
      }) as TranscribeDeps["callTranscribe"],
    };
    await assert.rejects(
      () => runTranscribe({ audioWavBase64: AUDIO }, deps),
      { message: "network down" },
    );
    assert.equal(tracker.records().length, 0);
    assert.equal(tracker.totals().spikeTotalUsd, 0);
  });

  test("a cap breach on the failed ASR call replaces it as a spending stop", async () => {
    const tracker = createUsageTracker({ spikeCapUsd: 0.01 });
    const deps: TranscribeDeps = {
      tracker,
      callTranscribe: (async () => {
        throw billedThrow(0.12, 300);
      }) as TranscribeDeps["callTranscribe"],
    };
    await assert.rejects(
      () => runTranscribe({ audioWavBase64: AUDIO }, deps),
      /spike cap/,
    );
    assert.equal(tracker.records().length, 0);
  });

  test("a billed cleanup throw is recorded after the ASR success, then rethrown", async () => {
    const tracker = createUsageTracker();
    const deps: TranscribeDeps = {
      tracker,
      callTranscribe: (async () => ({
        turns: [{ startSec: 0, text: "hello" }],
        latencyMs: 300,
        costUsd: 0.12,
      })) as TranscribeDeps["callTranscribe"],
      cleanupPrompt: "{{raw_turns}}",
      callCleanup: (async () => {
        throw billedThrow(0.05, 120);
      }) as TranscribeDeps["callCleanup"],
    };
    await assert.rejects(
      () => runTranscribe({ audioWavBase64: AUDIO }, deps),
      { message: "meta: response text was not JSON" },
    );
    assert.equal(tracker.records().length, 2);
    const [, cleanup] = tracker.records();
    assert.equal(cleanup.model, CLEANUP_MODEL);
    assert.equal(cleanup.step, "transcribe-cleanup");
    assert.equal(cleanup.costUsd, 0.05);
    assert.equal(tracker.totals().spikeTotalUsd, 0.17);
  });

  test("a plain cleanup throw records only the ASR success, still rethrown", async () => {
    const tracker = createUsageTracker();
    const deps: TranscribeDeps = {
      tracker,
      callTranscribe: (async () => ({
        turns: [{ startSec: 0, text: "hello" }],
        latencyMs: 300,
        costUsd: 0.12,
      })) as TranscribeDeps["callTranscribe"],
      cleanupPrompt: "{{raw_turns}}",
      callCleanup: (async () => {
        throw new Error("network down");
      }) as TranscribeDeps["callCleanup"],
    };
    await assert.rejects(
      () => runTranscribe({ audioWavBase64: AUDIO }, deps),
      { message: "network down" },
    );
    assert.equal(tracker.records().length, 1);
    assert.equal(tracker.totals().spikeTotalUsd, 0.12);
  });
});
