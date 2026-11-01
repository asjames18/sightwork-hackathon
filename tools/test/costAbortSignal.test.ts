/**
 * Offline test of the cost step's abort-signal wiring
 * (src/lib/pipeline/cost.ts, src/lib/pipeline/runPlan.ts,
 * src/lib/meta/client.ts). Stopping a run used to stop only
 * before the next pipeline step: the in-flight cost call ran
 * to completion and billed, because no signal reached its
 * fetch. The cost step now forwards its dep signal to its
 * Spark caller, runPlan hands the route's request signal to
 * the cost deps, and the Meta cost adapter forwards the
 * signal to the Meta client (which already passes it to the
 * fetch, per tools/test/sparkAbortSignal.test.ts). A fake
 * caller only; no network, no key, no paid call. The review
 * and picturing steps do not forward a signal yet, so this
 * covers the cost leg only; the other legs stay exactly as
 * before.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCostSparkCaller } from "@/lib/meta/client";
import { estimateCost } from "@/lib/pipeline/cost";
import { createUsageTracker } from "@/lib/pipeline/usage";

async function estimateCostWithCapturingCaller(signal: AbortSignal | undefined) {
  let seen: AbortSignal | undefined = undefined;
  let seenKey = false;
  const callSpark = async (req: { signal?: AbortSignal }) => {
    seenKey = "signal" in req;
    seen = req.signal;
    throw new Error("spark boom");
  };
  let caught: unknown;
  try {
    await estimateCost(
      { spaceName: "Kitchen", generatedFrom: "walkthrough", inventory: [], issues: [], materials: [], workOrder: [], region: "Sebring, FL" },
      {
        prompt: "p",
        schema: {},
        callSpark: callSpark as never,
        tracker: createUsageTracker(),
        ...(signal !== undefined ? { signal } : {}),
      },
    );
  } catch (err) {
    caught = err;
  }
  return { seen, seenKey, caught };
}

test("estimateCost forwards its dep signal to the Spark caller", async () => {
  const controller = new AbortController();
  const { seen, seenKey, caught } = await estimateCostWithCapturingCaller(controller.signal);
  assert.equal(seenKey, true);
  assert.equal(seen, controller.signal);
  assert.equal((caught as Error).message, "spark boom");
});

test("estimateCost without a signal passes none, as before", async () => {
  const { seen, caught } = await estimateCostWithCapturingCaller(undefined);
  assert.equal(seen, undefined);
  assert.equal((caught as Error).message, "spark boom");
});

test("the Meta cost adapter forwards the signal to the client", async () => {
  let seen: AbortSignal | undefined = undefined;
  const fakeClient = {
    callSpark: async (req: { signal?: AbortSignal }) => {
      seen = req.signal;
      return { json: {}, latencyMs: 1, costUsd: 0 };
    },
  } as unknown as Parameters<typeof createCostSparkCaller>[0];
  const controller = new AbortController();
  const caller = createCostSparkCaller(fakeClient);
  await caller({ model: "muse-spark-1.3", prompt: "p", schema: {}, signal: controller.signal });
  assert.equal(seen, controller.signal);
});

test("the Meta cost adapter without a signal passes none, as before", async () => {
  let seen: AbortSignal | undefined = undefined;
  let seenKey = false;
  const fakeClient = {
    callSpark: async (req: { signal?: AbortSignal }) => {
      seenKey = "signal" in req;
      seen = req.signal;
      return { json: {}, latencyMs: 1, costUsd: 0 };
    },
  } as unknown as Parameters<typeof createCostSparkCaller>[0];
  const caller = createCostSparkCaller(fakeClient);
  await caller({ model: "muse-spark-1.3", prompt: "p", schema: {} });
  assert.equal(seen, undefined);
  assert.equal(seenKey, true);
});
