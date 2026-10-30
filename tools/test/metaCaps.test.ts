/** Spend bounds on the Meta callers (image n cap 3cde733, Spark image cap 7a9f99c, ASR 32 MB audio cap c8aaf20): over-cap requests throw before any fetch. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createMetaClient } from "@/lib/meta/client";
import { createImageCaller } from "@/lib/meta/image";
import { createAsrTranscribeCaller } from "@/lib/meta/transcribe";

/** Base64 of a WAV-headed buffer of exactly `bytes` bytes (RIFF/WAVE header, zero padding). */
function wavBase64(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  buf.write("RIFF", 0, "ascii");
  buf.write("WAVE", 8, "ascii");
  return buf.toString("base64");
}

const MB32 = 32 * 1024 * 1024;

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

function noFetch(): { fetchImpl: typeof fetch; calls: () => number } {
  let n = 0;
  const fetchImpl = (async () => {
    n += 1;
    throw new Error("test: fetch must not be called");
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => n };
}

describe("meta spend caps", () => {
  test("Spark: 49 images throws before any fetch", async () => {
    const f = noFetch();
    const client = createMetaClient({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(
      client.callSpark({ model: "muse-spark-1.3", prompt: "p", images: Array(49).fill(JPEG), schema: {} }),
      /at most 48 images/,
    );
    assert.equal(f.calls(), 0);
  });

  test("Spark: 48 images passes the cap and reaches fetch", async () => {
    const f = noFetch();
    const client = createMetaClient({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(
      client.callSpark({ model: "muse-spark-1.3", prompt: "p", images: Array(48).fill(JPEG), schema: {} }),
      (err: Error) => !/at most 48 images/.test(err.message),
    );
    assert.ok(f.calls() >= 1);
  });

  test("Image: n=5 throws before any fetch", async () => {
    const f = noFetch();
    const caller = createImageCaller({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(caller({ model: "muse-image-1.0", prompt: "p", image: JPEG, n: 5 }));
    assert.equal(f.calls(), 0);
  });

  test("Image: n=4 passes the cap and reaches fetch", async () => {
    const f = noFetch();
    const caller = createImageCaller({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(caller({ model: "muse-image-1.0", prompt: "p", image: JPEG, n: 4 }));
    assert.ok(f.calls() >= 1);
  });

  test("ASR: 32 MB + 1 byte of audio throws before any fetch", async () => {
    const f = noFetch();
    const caller = createAsrTranscribeCaller({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(
      caller({ model: "muse-voice-transcribe-1.0", mode: "standard", audioWavBase64: wavBase64(MB32 + 1), keywordBias: [] }),
      /at most 32 MB/,
    );
    assert.equal(f.calls(), 0);
  });

  test("ASR: exactly 32 MB of audio passes the cap and reaches fetch", async () => {
    const f = noFetch();
    const caller = createAsrTranscribeCaller({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(
      caller({ model: "muse-voice-transcribe-1.0", mode: "standard", audioWavBase64: wavBase64(MB32), keywordBias: [] }),
      (err: Error) => !/at most 32 MB/.test(err.message),
    );
    assert.ok(f.calls() >= 1);
  });
});
