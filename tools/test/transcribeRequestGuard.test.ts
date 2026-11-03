/** Transcribe caller request guard (src/lib/meta/transcribe.ts): a direct
 * caller bypassing the transcribe step used to pass a non-object straight
 * through — a null request reading .model threw a bare TypeError with
 * no step name. A request that is not an object now throws a named
 * asr error before any fetch, the same named-error rule the SAM and
 * Image callers follow. A valid request still runs, as before.
 * Pure, no network, no key. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createAsrTranscribeCaller } from "@/lib/meta/transcribe";

type Caller = ReturnType<typeof createAsrTranscribeCaller>;
type Req = Parameters<Caller>[0];

/** A tiny PCM WAV: 44-byte header plus a few silent samples. */
function wavBase64(): string {
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

function harness() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        audioDurationMs: 42000,
        turns: [{ turnId: "t1", startMs: 0, endMs: 42000, transcript: "hello" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  const caller = createAsrTranscribeCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  return { caller, fetchCalls: () => calls };
}

function validReq(): Req {
  return { model: "muse-voice-transcribe-1.0", mode: "standard", audioWavBase64: wavBase64(), keywordBias: [] };
}

describe("Transcribe caller request guard", () => {
  test("a null request throws a named asr error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller(null as unknown as Req),
      /asr: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a string request throws a named asr error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller("hello" as unknown as Req),
      /asr: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an array request throws a named asr error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller([] as unknown as Req),
      /asr: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a valid request still runs and returns one turn at the spike cost", async () => {
    const { caller, fetchCalls } = harness();
    const out = await caller(validReq());
    assert.equal(out.turns.length, 1);
    assert.equal(out.turns[0].text, "hello");
    assert.equal(out.costUsd, 0.0021);
    assert.equal(fetchCalls(), 1);
  });
});
