/**
 * A billed-but-failed Baseten reason/review call is recorded under the
 * Baseten model, not muse-spark-1.3 (offline): the success path already
 * records `res.model ?? SPARK_MODEL`, but the failure path passed
 * SPARK_MODEL unconditionally, so per-model totals misattributed the
 * spend. BasetenCallError now carries its configured model and the
 * steps read it via failedCallModel; an error without a model still
 * falls back to the requested model. No live calls; every model caller
 * is a stub and fetch throws.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { BasetenCallError } from "@/lib/meta/baseten";
import { runReason, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { runReview, REVIEW_NOT_RUN, REVIEW_SCHEMA, type ReviewDeps, type ReviewInput } from "@/lib/pipeline/review";
import { createUsageTracker } from "@/lib/pipeline/usage";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const BASETEN_MODEL = "meta-models/muse-spark-open-1026";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("basetenFailedCallModel.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

function reasonInput(): ReasonInput {
  return {
    frames: [{ tSec: 0, dataUrl: JPEG }],
    segmentation: null,
    transcript: null,
    durationSec: 60,
  };
}

function reviewInput(): ReviewInput {
  return {
    issues: [{ rank: 1, title: "Cable across the steps", detail: "A cable runs across the steps." }],
    frames: [{ frameIndex: 0, dataUrl: JPEG }],
  };
}

describe("Baseten failed-call model", () => {
  test("runReason records a BasetenCallError under the Baseten model", async () => {
    const tracker = createUsageTracker();
    const deps: ReasonDeps = {
      prompt: "offline",
      schema: REASON_SCHEMA,
      tracker,
      callSpark: (async () => {
        throw new BasetenCallError("baseten: response text was not JSON", 0.05, 120, BASETEN_MODEL);
      }) as ReasonDeps["callSpark"],
    };
    await assert.rejects(runReason(reasonInput(), deps), /not JSON/);
    assert.equal(tracker.records().length, 1);
    const [rec] = tracker.records();
    assert.equal(rec.model, BASETEN_MODEL);
    assert.equal(rec.step, "reason");
    assert.equal(rec.costUsd, 0.05);
  });

  test("runReview records a BasetenCallError under the Baseten model, still REVIEW_NOT_RUN", async () => {
    const tracker = createUsageTracker();
    const deps: ReviewDeps = {
      prompt: "offline",
      schema: REVIEW_SCHEMA,
      tracker,
      callSpark: (async () => {
        throw new BasetenCallError("baseten: response text was not JSON", 0.04, 90, BASETEN_MODEL);
      }) as ReviewDeps["callSpark"],
    };
    assert.deepEqual(await runReview(reviewInput(), deps), { ...REVIEW_NOT_RUN });
    assert.equal(tracker.records().length, 1);
    const [rec] = tracker.records();
    assert.equal(rec.model, BASETEN_MODEL);
    assert.equal(rec.step, "review");
    assert.equal(rec.costUsd, 0.04);
  });

  test("an error without a model still falls back to the requested model", async () => {
    const tracker = createUsageTracker();
    const deps: ReasonDeps = {
      prompt: "offline",
      schema: REASON_SCHEMA,
      tracker,
      callSpark: (async () => {
        const err = new Error("meta: response text was not JSON");
        Object.assign(err, { costUsd: 0.05, latencyMs: 120 });
        throw err;
      }) as ReasonDeps["callSpark"],
    };
    await assert.rejects(runReason(reasonInput(), deps), /not JSON/);
    assert.equal(tracker.records().length, 1);
    assert.equal(tracker.records()[0].model, "muse-spark-1.3");
  });
});
