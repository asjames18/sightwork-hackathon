/**
 * Offline test of the SAM caller's cost-carrying JSON failure
 * (src/lib/meta/sam.ts). A 200 response whose body is not JSON was
 * billed at the flat per-request rate like any other 200, but
 * res.json() used to throw a raw SyntaxError, so the segment step's
 * recordFailedCall saw no costUsd and the spend was dropped from
 * the route total. It now throws SamCallError carrying the request
 * cost, like the no-text and bad-token branches. Fake fetch only;
 * no network, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SamCallError, createSamSegmentCaller } from "@/lib/meta/sam";
import { createUsageTracker, recordFailedCall } from "@/lib/pipeline/usage";

const REQUEST_COST = 0.0025;

/** data:image/jpeg URL whose decoded payload is a JPEG header plus padding. */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const req = {
  model: "sam-3.1",
  concept: "chair",
  frameIndex: 0,
  dataUrl: jpegDataUrl(64),
};

test("a 200 with a non-JSON body throws SamCallError carrying the request cost", async () => {
  const fetchImpl = (async () =>
    new Response("{not json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
  const caller = createSamSegmentCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  let caught: unknown;
  try {
    await caller(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof SamCallError, `expected SamCallError, got ${String(caught)}`);
  assert.equal((caught as Error).message, "sam: response was not JSON");
  assert.equal((caught as SamCallError).costUsd, REQUEST_COST);
  assert.ok(
    Number.isFinite((caught as SamCallError).latencyMs) &&
      (caught as SamCallError).latencyMs >= 0,
  );
  // The step's recordFailedCall path records it on the tracker.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "sam-3.1", "segment", caught);
  assert.equal(tracker.records().length, 1);
  assert.equal(tracker.totals().spikeTotalUsd, REQUEST_COST);
});

test("a 200 with a JSON array body still throws the JSON failure, not a text failure", async () => {
  // An array parses as JSON but is not the object the caller reads,
  // so it must not fall through to the no-text branch with a
  // different message; the caller casts it and extractText finds
  // no text, which is the pre-existing no-text path.
  const fetchImpl = (async () =>
    new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
  const caller = createSamSegmentCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  let caught: unknown;
  try {
    await caller(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof SamCallError, `expected SamCallError, got ${String(caught)}`);
  assert.equal((caught as Error).message, "sam: response had no text output");
  assert.equal((caught as SamCallError).costUsd, REQUEST_COST);
});
