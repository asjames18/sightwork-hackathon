/**
 * Offline test of the Image caller's cost-carrying multi-candidate
 * failures (src/lib/meta/image.ts). One image costs $0.01, billed
 * per completed candidate, so a 2-candidate call whose first image
 * succeeds and whose second request then fails has already spent
 * $0.01: the failure throws ImageCallError with costUsd/latencyMs
 * (mirroring SamCallError) so the renderAfter step's recordFailedCall
 * can record it instead of dropping the spend from the route total.
 * A failure before any billing keeps the plain error, and a second
 * candidate that merely yields no completed image still returns the
 * short list. Fake fetch only; no network, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ImageCallError, createImageCaller } from "@/lib/meta/image";
import { createUsageTracker, recordFailedCall } from "@/lib/pipeline/usage";

const IMAGE_COST = 0.01;
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
/** Base64 of a JPEG header, as a completed image_generation_call result. */
const JPEG_RESULT = "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

function completedBody(): string {
  return JSON.stringify({
    output: [{ type: "image_generation_call", status: "completed", result: JPEG_RESULT }],
  });
}

function emptyBody(): string {
  return JSON.stringify({ output: [] });
}

/** Fake fetch serving one canned response (or throw) per call, in order. */
function sequencedFetch(steps: Array<Response | Error>): typeof fetch {
  let i = 0;
  return (async () => {
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step instanceof Error) throw step;
    return step;
  }) as unknown as typeof fetch;
}

function caller(fetchImpl: typeof fetch) {
  return createImageCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
}

const req = { model: "muse-image-1.0", prompt: "p", image: JPEG, n: 2 };

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
}

async function expectCostError(
  attempt: Promise<unknown>,
  pattern: RegExp,
): Promise<ImageCallError> {
  let caught: unknown;
  try {
    await attempt;
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof ImageCallError, `expected ImageCallError, got ${String(caught)}`);
  assert.match((caught as Error).message, pattern);
  assert.equal((caught as ImageCallError).name, "ImageCallError");
  assert.equal((caught as ImageCallError).costUsd, IMAGE_COST);
  assert.ok(
    Number.isFinite((caught as ImageCallError).latencyMs) &&
      (caught as ImageCallError).latencyMs >= 0,
  );
  return caught as ImageCallError;
}

test("a failed second request throws ImageCallError carrying the first image's cost", async () => {
  const call = caller(
    sequencedFetch([okResponse(completedBody()), new Response("boom", { status: 500 })]),
  );
  const caught = await expectCostError(call(req), /^image: 500 boom$/);
  // The step's recordFailedCall path records it on the tracker.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-image-1.0", "renderAfter", caught);
  assert.equal(tracker.records().length, 1);
  assert.equal(tracker.totals().spikeTotalUsd, IMAGE_COST);
});

test("a fetch throw on the second request carries the first image's cost, message verbatim", async () => {
  const call = caller(
    sequencedFetch([okResponse(completedBody()), new Error("test: network down")]),
  );
  await expectCostError(call(req), /^test: network down$/);
});

test("a failure before any billing keeps the plain error, with no cost to record", async () => {
  const call = caller(sequencedFetch([new Response("boom", { status: 500 })]));
  let caught: unknown;
  try {
    await call(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof Error);
  assert.ok(!(caught instanceof ImageCallError));
  assert.match((caught as Error).message, /^image: 500 boom$/);
  assert.equal((caught as { costUsd?: unknown }).costUsd, undefined);
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-image-1.0", "renderAfter", caught);
  assert.equal(tracker.records().length, 0);
});

test("two good candidates still return both images with the summed cost", async () => {
  const call = caller(
    sequencedFetch([okResponse(completedBody()), okResponse(completedBody())]),
  );
  const res = await call(req);
  assert.equal(res.images.length, 2);
  assert.equal(res.costUsd, 2 * IMAGE_COST);
});

test("a second candidate with no completed image still returns the short list", async () => {
  const call = caller(sequencedFetch([okResponse(completedBody()), okResponse(emptyBody())]));
  const res = await call(req);
  assert.equal(res.images.length, 1);
  assert.equal(res.costUsd, IMAGE_COST);
});
