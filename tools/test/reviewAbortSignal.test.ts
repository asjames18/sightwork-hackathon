/**
 * Offline test of the review step's abort-signal wiring
 * (src/lib/pipeline/review.ts, src/lib/pipeline/runPlan.ts).
 * Stopping a run used to stop only before the next pipeline step:
 * the in-flight review call ran to completion and billed, because
 * no signal reached it. The review step now forwards its dep
 * signal to its Spark caller, and runPlan hands the route's
 * request signal to the review deps. The route wires the review
 * step with the reason step's provider caller, which already
 * forwards the signal on both the Meta and Baseten paths, so no
 * adapter change is needed here. A fake caller only; no network,
 * no key, no paid call. The picturing step does not forward a
 * signal yet, so this covers the review leg only; the other leg
 * stays exactly as before.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEW_SCHEMA, runReview, type ReviewInput } from "@/lib/pipeline/review";
import { createUsageTracker } from "@/lib/pipeline/usage";

const png = (tag: number) =>
  `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag, 0, 0, 0]).toString("base64")}`;

const input: ReviewInput = {
  issues: [
    { rank: 1, title: "Cable across the stage steps", detail: "A black power cord runs across the second step.", proofFrames: [{ frameIndex: 4, tSec: 8, caption: "cord on step" }] },
  ],
  frames: [{ frameIndex: 4, dataUrl: png(4) }],
};

async function runReviewWithCapturingCaller(signal: AbortSignal | undefined) {
  let seen: AbortSignal | undefined = undefined;
  const callSpark = async (req: { signal?: AbortSignal }) => {
    seen = req.signal;
    throw new Error("spark boom");
  };
  const review = await runReview(input, {
    prompt: "prompt 06, filled",
    schema: REVIEW_SCHEMA,
    tracker: createUsageTracker(),
    callSpark: callSpark as never,
    ...(signal !== undefined ? { signal } : {}),
  });
  return { seen, review };
}

test("runReview forwards its dep signal to the Spark caller", async () => {
  const controller = new AbortController();
  const { seen, review } = await runReviewWithCapturingCaller(controller.signal);
  assert.equal(seen, controller.signal);
  assert.deepEqual(review, { ran: false, items: [] });
});

test("runReview without a signal passes none, as before", async () => {
  const { seen, review } = await runReviewWithCapturingCaller(undefined);
  assert.equal(seen, undefined);
  assert.deepEqual(review, { ran: false, items: [] });
});
