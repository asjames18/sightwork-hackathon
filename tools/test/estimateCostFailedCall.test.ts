/**
 * estimateCost records a billed-but-failed call (offline): a caller
 * throw carrying costUsd/latencyMs (e.g. MetaCallError on a non-JSON
 * response) lands on the tracker before the throw propagates, so the
 * route total still counts the failed-parse spend; a plain throw
 * records nothing. No live calls; every model caller is a stub and
 * fetch throws.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, type CostDeps, type CostInput } from "@/lib/pipeline/cost";
import { createUsageTracker } from "@/lib/pipeline/usage";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("estimateCostFailedCall.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

function input(): CostInput {
  return {
    spaceName: "Kitchen",
    generatedFrom: "walkthrough",
    inventory: [],
    issues: [],
    materials: [],
    workOrder: [],
    region: "Sebring, FL",
  };
}

/** A caller throw that still spent money, like MetaCallError. */
function billedThrow(): CostDeps["callSpark"] {
  return (async () => {
    const err = new Error("meta: response text was not JSON");
    Object.assign(err, { costUsd: 0.04, latencyMs: 110 });
    throw err;
  }) as CostDeps["callSpark"];
}

describe("estimateCost failed-call spend", () => {
  test("a billed throw is recorded, then rethrown unchanged", async () => {
    const tracker = createUsageTracker();
    const deps: CostDeps = {
      prompt: "offline",
      schema: {},
      tracker,
      callSpark: billedThrow(),
    };
    await assert.rejects(estimateCost(input(), deps), /not JSON/);
    assert.equal(tracker.records().length, 1);
    const [rec] = tracker.records();
    assert.equal(rec.model, "muse-spark-1.3");
    assert.equal(rec.step, "estimateCost");
    assert.equal(rec.costUsd, 0.04);
    assert.equal(rec.latencyMs, 110);
    assert.equal(tracker.totals().spikeTotalUsd, 0.04);
  });

  test("a plain throw records nothing", async () => {
    const tracker = createUsageTracker();
    const deps: CostDeps = {
      prompt: "offline",
      schema: {},
      tracker,
      callSpark: (async () => {
        throw new Error("network down");
      }) as CostDeps["callSpark"],
    };
    await assert.rejects(estimateCost(input(), deps), /network down/);
    assert.equal(tracker.records().length, 0);
    assert.equal(tracker.totals().spikeTotalUsd, 0);
  });

  test("a cap breach on the failed call propagates as a spending stop", async () => {
    const tracker = createUsageTracker({ spikeCapUsd: 0.01 });
    const deps: CostDeps = {
      prompt: "offline",
      schema: {},
      tracker,
      callSpark: billedThrow(),
    };
    await assert.rejects(estimateCost(input(), deps), /spike cap/);
    assert.equal(tracker.records().length, 0);
  });
});
