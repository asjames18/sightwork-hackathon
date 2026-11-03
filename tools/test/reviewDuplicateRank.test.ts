/**
 * runReview rejects a repeated issue rank before any call is spent:
 * prompt 06 lists one "id <rank>" per problem and asks for one verdict
 * per id, so two problems sharing a rank would leave the second
 * unreviewed while parseReview keeps only the first verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEW_SCHEMA, runReview, type ReviewDeps, type ReviewInput } from "@/lib/pipeline/review";
import { createUsageTracker } from "@/lib/pipeline/usage";

const png = (tag: number) =>
  `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag, 0, 0, 0]).toString("base64")}`;

const input: ReviewInput = {
  issues: [
    { rank: 1, title: "Cable across the stage steps", detail: "A black power cord runs across the second step.", proofFrames: [{ frameIndex: 4, tSec: 8, caption: "cord on step" }] },
    { rank: 1, title: "Loose floor tile by the pulpit", detail: "One tile is lifted at the corner.", proofFrames: [{ frameIndex: 5, tSec: 10, caption: "tile corner" }] },
  ],
  frames: [
    { frameIndex: 4, dataUrl: png(4) },
    { frameIndex: 5, dataUrl: png(5) },
  ],
};

test("duplicate rank: review does not run and no call is spent", async () => {
  const tracker = createUsageTracker();
  let calls = 0;
  const deps: ReviewDeps = {
    prompt: "prompt 06, filled",
    schema: REVIEW_SCHEMA,
    tracker,
    callSpark: async () => {
      calls += 1;
      return { json: { ran: true, items: [] }, latencyMs: 1, costUsd: 0 };
    },
  };
  const review = await runReview(input, deps);
  assert.deepEqual(review, { ran: false, items: [] });
  assert.equal(calls, 0);
  assert.equal(tracker.totals().calls, 0);
});

test("distinct ranks still run", async () => {
  const tracker = createUsageTracker();
  let calls = 0;
  const deps: ReviewDeps = {
    prompt: "prompt 06, filled",
    schema: REVIEW_SCHEMA,
    tracker,
    callSpark: async () => {
      calls += 1;
      return {
        json: {
          ran: true,
          items: [
            { problemId: "1", verified: true, reason: "Photo A shows a black cord across the second step." },
            { problemId: "2", verified: true, reason: "Photo B shows a tile lifted at one corner." },
          ],
        },
        latencyMs: 24000,
        costUsd: 0.03,
      };
    },
  };
  const distinct: ReviewInput = {
    ...input,
    issues: [
      input.issues[0],
      { ...input.issues[1], rank: 2 },
    ],
  };
  const review = await runReview(distinct, deps);
  assert.equal(review.ran, true);
  assert.equal(review.items.length, 2);
  assert.equal(calls, 1);
});
