/**
 * runReview records a billed-but-failed call, then still returns
 * REVIEW_NOT_RUN (offline): review never throws on a call failure,
 * so unlike reason/cost the spend lands on the tracker and the step
 * returns "didn't run" instead of rethrowing; a plain throw records
 * nothing, and a tracker throw on the failed call is also just a
 * failed review, not a spending stop. No live calls; every model
 * caller is a stub and fetch throws.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runReview, REVIEW_NOT_RUN, REVIEW_SCHEMA, type ReviewDeps, type ReviewInput } from "@/lib/pipeline/review";
import { createUsageTracker } from "@/lib/pipeline/usage";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runReviewFailedCall.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

function input(): ReviewInput {
  return {
    issues: [{ rank: 1, title: "Cable across the steps", detail: "A cable runs across the steps." }],
    frames: [{ frameIndex: 0, dataUrl: JPEG }],
  };
}

/** A caller throw that still spent money, like MetaCallError. */
function billedThrow(): ReviewDeps["callSpark"] {
  return (async () => {
    const err = new Error("meta: response text was not JSON");
    Object.assign(err, { costUsd: 0.05, latencyMs: 120 });
    throw err;
  }) as ReviewDeps["callSpark"];
}

describe("runReview failed-call spend", () => {
  test("a billed throw is recorded, then returns REVIEW_NOT_RUN", async () => {
    const tracker = createUsageTracker();
    const deps: ReviewDeps = {
      prompt: "offline",
      schema: REVIEW_SCHEMA,
      tracker,
      callSpark: billedThrow(),
    };
    assert.deepEqual(await runReview(input(), deps), { ...REVIEW_NOT_RUN });
    assert.equal(tracker.records().length, 1);
    const [rec] = tracker.records();
    assert.equal(rec.model, "muse-spark-1.3");
    assert.equal(rec.step, "review");
    assert.equal(rec.costUsd, 0.05);
    assert.equal(rec.latencyMs, 120);
    assert.equal(tracker.totals().spikeTotalUsd, 0.05);
  });

  test("a plain throw records nothing, still returns REVIEW_NOT_RUN", async () => {
    const tracker = createUsageTracker();
    const deps: ReviewDeps = {
      prompt: "offline",
      schema: REVIEW_SCHEMA,
      tracker,
      callSpark: (async () => {
        throw new Error("network down");
      }) as ReviewDeps["callSpark"],
    };
    assert.deepEqual(await runReview(input(), deps), { ...REVIEW_NOT_RUN });
    assert.equal(tracker.records().length, 0);
    assert.equal(tracker.totals().spikeTotalUsd, 0);
  });

  test("a cap breach on the failed call is a failed review, not a throw", async () => {
    const tracker = createUsageTracker({ spikeCapUsd: 0.01 });
    const deps: ReviewDeps = {
      prompt: "offline",
      schema: REVIEW_SCHEMA,
      tracker,
      callSpark: billedThrow(),
    };
    assert.deepEqual(await runReview(input(), deps), { ...REVIEW_NOT_RUN });
    assert.equal(tracker.records().length, 0);
  });
});
