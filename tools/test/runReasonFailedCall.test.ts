/**
 * runReason records a billed-but-failed call, and recordFailedCall
 * skips errors without usable spend (offline): a caller throw carrying
 * costUsd/latencyMs (e.g. MetaCallError on a non-JSON response) lands
 * on the tracker before the throw propagates, so the route total still
 * counts the failed-parse spend; a plain throw records nothing. No
 * live calls; every model caller is a stub and fetch throws.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runReason, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker, recordFailedCall } from "@/lib/pipeline/usage";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runReasonFailedCall.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

function input(): ReasonInput {
  return {
    frames: [{ tSec: 0, dataUrl: JPEG }],
    segmentation: null,
    transcript: null,
    durationSec: 60,
  };
}

/** A caller throw that still spent money, like MetaCallError. */
function billedThrow(): ReasonDeps["callSpark"] {
  return (async () => {
    const err = new Error("meta: response text was not JSON");
    Object.assign(err, { costUsd: 0.05, latencyMs: 120 });
    throw err;
  }) as ReasonDeps["callSpark"];
}

describe("runReason failed-call spend", () => {
  test("a billed throw is recorded, then rethrown unchanged", async () => {
    const tracker = createUsageTracker();
    const deps: ReasonDeps = {
      prompt: "offline",
      schema: REASON_SCHEMA,
      tracker,
      callSpark: billedThrow(),
    };
    await assert.rejects(runReason(input(), deps), /not JSON/);
    assert.equal(tracker.records().length, 1);
    const [rec] = tracker.records();
    assert.equal(rec.model, "muse-spark-1.3");
    assert.equal(rec.step, "reason");
    assert.equal(rec.costUsd, 0.05);
    assert.equal(rec.latencyMs, 120);
    assert.equal(tracker.totals().spikeTotalUsd, 0.05);
  });

  test("a plain throw records nothing", async () => {
    const tracker = createUsageTracker();
    const deps: ReasonDeps = {
      prompt: "offline",
      schema: REASON_SCHEMA,
      tracker,
      callSpark: (async () => {
        throw new Error("network down");
      }) as ReasonDeps["callSpark"],
    };
    await assert.rejects(runReason(input(), deps), /network down/);
    assert.equal(tracker.records().length, 0);
    assert.equal(tracker.totals().spikeTotalUsd, 0);
  });
});

describe("recordFailedCall", () => {
  test("skips errors without finite, non-negative spend", () => {
    const tracker = createUsageTracker();
    recordFailedCall(tracker, "muse-spark-1.3", "reason", new Error("plain"));
    recordFailedCall(tracker, "muse-spark-1.3", "reason", null);
    recordFailedCall(tracker, "muse-spark-1.3", "reason", { costUsd: Number.NaN, latencyMs: 10 });
    recordFailedCall(tracker, "muse-spark-1.3", "reason", { costUsd: 0.05, latencyMs: -1 });
    assert.equal(tracker.records().length, 0);
  });

  test("a cap breach on the failed call propagates as a spending stop", () => {
    const tracker = createUsageTracker({ spikeCapUsd: 0.01 });
    const err = new Error("meta: response text was not JSON");
    Object.assign(err, { costUsd: 0.05, latencyMs: 120 });
    assert.throws(() => recordFailedCall(tracker, "muse-spark-1.3", "reason", err), /spike cap/);
    assert.equal(tracker.records().length, 0);
  });
});
