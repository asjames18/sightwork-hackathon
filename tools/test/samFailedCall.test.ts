/**
 * Offline test of the SAM caller's cost-carrying parse failures
 * (src/lib/meta/sam.ts). A 200 response with no text output, or with
 * output_text whose box tokens do not parse, still spent the flat
 * per-request cost: the failure throws SamCallError with
 * costUsd/latencyMs (mirroring BasetenCallError) so the segment
 * step's recordFailedCall can record it instead of dropping the
 * spend from the route total. Fake fetch only; no network, no key.
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

function harness(body: string) {
  const fetchImpl = (async () =>
    new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  return createSamSegmentCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
}

const req = {
  model: "sam-3.1",
  concept: "chair",
  frameIndex: 0,
  dataUrl: jpegDataUrl(64),
};

function outputBody(outputText: string): string {
  return JSON.stringify({ output_text: outputText });
}

async function expectCostError(
  caller: ReturnType<typeof createSamSegmentCaller>,
  pattern: RegExp,
): Promise<SamCallError> {
  let caught: unknown;
  try {
    await caller(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof SamCallError, `expected SamCallError, got ${String(caught)}`);
  assert.match((caught as Error).message, pattern);
  assert.equal((caught as SamCallError).name, "SamCallError");
  assert.equal((caught as SamCallError).costUsd, REQUEST_COST);
  assert.ok(
    Number.isFinite((caught as SamCallError).latencyMs) &&
      (caught as SamCallError).latencyMs >= 0,
  );
  return caught as SamCallError;
}

test("unparseable box tokens throw SamCallError carrying the request cost", async () => {
  const caller = harness(outputBody("<|box;w=0;h=10;x1=0;y1=0;x2=5;y2=5;c=0.9|>"));
  const caught = await expectCostError(caller, /^sam: box token has a non-positive w or h$/);
  // The step's recordFailedCall path records it on the tracker.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "sam-3.1", "segment", caught);
  assert.equal(tracker.records().length, 1);
  assert.equal(tracker.totals().spikeTotalUsd, REQUEST_COST);
});

test("a 200 with no text output throws SamCallError carrying the request cost", async () => {
  const caller = harness(JSON.stringify({}));
  const caught = await expectCostError(caller, /^sam: response had no text output$/);
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "sam-3.1", "segment", caught);
  assert.equal(tracker.records().length, 1);
  assert.equal(tracker.totals().spikeTotalUsd, REQUEST_COST);
});

test("valid box tokens still return instances with the request cost", async () => {
  const caller = harness(outputBody("<|box;w=100;h=100;x1=10;y1=20;x2=50;y2=60;c=0.9|>"));
  const res = await caller(req);
  assert.equal(res.costUsd, REQUEST_COST);
  assert.equal(res.instances.length, 1);
  assert.deepEqual(res.instances[0].box, [100, 200, 500, 600]);
  assert.equal(res.instances[0].score, 0.9);
});
