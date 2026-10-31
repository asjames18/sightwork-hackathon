/**
 * Offline test of the Image caller's non-JSON 200 body
 * (src/lib/meta/image.ts). A 200 body that is not JSON used to throw
 * a raw SyntaxError from res.json(), surfacing parser internals
 * instead of the caller and the cause. It now throws a plain, named
 * error ("image: response was not JSON"). It stays plain on purpose
 * when nothing was billed: failed images are free, so the failure
 * cannot be priced and the step's recordFailedCall records nothing.
 * When an earlier candidate was already billed, the caller's catch
 * still wraps it in ImageCallError carrying that spend, like any
 * other mid-call failure. Fake fetch only; no network, no key.
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

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
}

/** Fake fetch serving one canned response per call, in order. */
function sequencedFetch(steps: Array<Response>): typeof fetch {
  let i = 0;
  return (async () => {
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
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

test("a non-JSON 200 body throws a named plain error and records no spend", async () => {
  const call = caller(sequencedFetch([okResponse("{not json")]));
  let caught: unknown;
  try {
    await call({ model: "muse-image-1.0", prompt: "p", image: JPEG, n: 1 });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof Error, `expected an Error, got ${String(caught)}`);
  assert.ok(!(caught instanceof ImageCallError), "unpriceable failure must not carry a cost");
  assert.equal((caught as Error).message, "image: response was not JSON");
  // The step's recordFailedCall path records nothing for a plain error.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-image-1.0", "renderAfter", caught);
  assert.equal(tracker.records().length, 0);
  assert.equal(tracker.totals().spikeTotalUsd, 0);
});

test("a non-JSON second body carries the first image's billed cost", async () => {
  const call = caller(sequencedFetch([okResponse(completedBody()), okResponse("{not json")]));
  let caught: unknown;
  try {
    await call({ model: "muse-image-1.0", prompt: "p", image: JPEG, n: 2 });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof ImageCallError, `expected ImageCallError, got ${String(caught)}`);
  assert.equal((caught as Error).message, "image: response was not JSON");
  assert.equal((caught as ImageCallError).costUsd, IMAGE_COST);
  assert.ok(
    Number.isFinite((caught as ImageCallError).latencyMs) &&
      (caught as ImageCallError).latencyMs >= 0,
  );
  // The step's recordFailedCall path records the earlier billed image.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-image-1.0", "renderAfter", caught);
  assert.equal(tracker.records().length, 1);
  assert.equal(tracker.totals().spikeTotalUsd, IMAGE_COST);
});

test("valid JSON still returns the completed image, unchanged", async () => {
  const call = caller(sequencedFetch([okResponse(completedBody())]));
  const res = await call({ model: "muse-image-1.0", prompt: "p", image: JPEG, n: 1 });
  assert.equal(res.images.length, 1);
  assert.equal(res.costUsd, IMAGE_COST);
});
