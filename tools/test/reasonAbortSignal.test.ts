/**
 * Offline test of the reason step's abort-signal wiring
 * (src/lib/pipeline/reason.ts, src/lib/pipeline/runPlan.ts,
 * src/lib/meta/client.ts). Stopping a run used to stop only
 * before the next pipeline step: the in-flight reason call ran
 * to completion and billed, because no signal reached its
 * fetch. The reason step now forwards its dep signal to its
 * Spark caller, runPlan hands the route's request signal to
 * the reason deps, and the Meta reason adapter forwards the
 * signal to the Meta client (which already passes it to the
 * fetch, per tools/test/sparkAbortSignal.test.ts). A fake
 * caller only; no network, no key, no paid call. The Baseten
 * reason adapter and the cost/review/picturing steps do not
 * forward a signal yet, so this covers the Meta reason leg
 * only; the other legs stay exactly as before.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createReasonSparkCaller } from "@/lib/meta/client";
import { runReason } from "@/lib/pipeline/reason";
import { createUsageTracker } from "@/lib/pipeline/usage";

// 1x1 PNG data URL (real PNG header, passes the reason step's
// frame validation without spending a call).
const FRAME = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function runReasonWithCapturingCaller(signal: AbortSignal | undefined) {
  let seen: AbortSignal | undefined = undefined;
  let seenKey = false;
  const callSpark = async (req: { signal?: AbortSignal }) => {
    seenKey = "signal" in req;
    seen = req.signal;
    throw new Error("spark boom");
  };
  let caught: unknown;
  try {
    await runReason(
      { frames: [{ tSec: 0, dataUrl: FRAME }], segmentation: null, transcript: null, durationSec: 10 },
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

test("runReason forwards its dep signal to the Spark caller", async () => {
  const controller = new AbortController();
  const { seen, seenKey, caught } = await runReasonWithCapturingCaller(controller.signal);
  assert.equal(seenKey, true);
  assert.equal(seen, controller.signal);
  assert.equal((caught as Error).message, "spark boom");
});

test("runReason without a signal passes none, as before", async () => {
  const { seen, caught } = await runReasonWithCapturingCaller(undefined);
  assert.equal(seen, undefined);
  assert.equal((caught as Error).message, "spark boom");
});

test("the Meta reason adapter forwards the signal to the client", async () => {
  let seen: AbortSignal | undefined = undefined;
  const fakeClient = {
    callSpark: async (req: { signal?: AbortSignal }) => {
      seen = req.signal;
      return { json: {}, latencyMs: 1, costUsd: 0 };
    },
  } as unknown as Parameters<typeof createReasonSparkCaller>[0];
  const controller = new AbortController();
  const caller = createReasonSparkCaller(fakeClient);
  await caller({ model: "muse-spark-1.3", prompt: "p", images: [], schema: {}, signal: controller.signal });
  assert.equal(seen, controller.signal);
});

test("the Meta reason adapter without a signal passes none, as before", async () => {
  let seen: AbortSignal | undefined = undefined;
  let seenKey = false;
  const fakeClient = {
    callSpark: async (req: { signal?: AbortSignal }) => {
      seenKey = "signal" in req;
      seen = req.signal;
      return { json: {}, latencyMs: 1, costUsd: 0 };
    },
  } as unknown as Parameters<typeof createReasonSparkCaller>[0];
  const caller = createReasonSparkCaller(fakeClient);
  await caller({ model: "muse-spark-1.3", prompt: "p", images: [], schema: {} });
  assert.equal(seen, undefined);
  assert.equal(seenKey, true);
});
