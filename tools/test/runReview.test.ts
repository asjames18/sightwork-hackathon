/**
 * Offline test of the reviewer step (src/lib/pipeline/review.ts, 29b3cc0) with a planted problem:
 * a plan with two problems the photos show and one they can't (a smell). The model caller is a stub
 * that answers the way prompt 06 asks, so nothing here touches the network or spends money.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEW_SCHEMA, runReview, type ReviewDeps, type ReviewInput } from "@/lib/pipeline/review";
import { createUsageTracker } from "@/lib/pipeline/usage";
import { reviewLine, reviewTally, verdictFor } from "@/lib/review";

const png = (tag: number) =>
  `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag, 0, 0, 0]).toString("base64")}`;

const input: ReviewInput = {
  issues: [
    { rank: 1, title: "Cable across the stage steps", detail: "A black power cord runs across the second step.", proofFrames: [{ frameIndex: 4, tSec: 8, caption: "cord on step" }] },
    { rank: 2, title: "Musty smell behind the curtain", detail: "Possible mildew behind the back curtain.", proofFrames: [{ frameIndex: 5, tSec: 10, caption: "back curtain" }] },
    { rank: 3, title: "Loose floor tile by the pulpit", detail: "One tile is lifted at the corner.", proofFrames: [{ frameIndex: 6, tSec: 12, caption: "tile corner" }] },
  ],
  frames: [
    { frameIndex: 4, dataUrl: png(4) },
    { frameIndex: 5, dataUrl: png(5) },
    { frameIndex: 6, dataUrl: png(6) },
  ],
};

/** What a reviewer following prompt 06 returns for this plan: the smell can't be seen, so it is not backed. */
const plantedAnswer = {
  ran: true,
  items: [
    { problemId: "1", verified: true, reason: "Photo A shows a black cord across the second step." },
    { problemId: "2", verified: false, reason: "A smell can't be seen; Photo B shows only a clean curtain." },
    { problemId: "3", verified: true, reason: "Photo C shows a tile lifted at one corner." },
  ],
  summary: "2 of 3 problems are visible in their photos.",
};

function deps(answers: unknown[], calls: Parameters<ReviewDeps["callSpark"]>[0][] = []) {
  const tracker = createUsageTracker();
  const d: ReviewDeps = {
    prompt: "prompt 06, filled",
    schema: REVIEW_SCHEMA,
    tracker,
    callSpark: async (req) => {
      calls.push(req);
      const json = answers.shift();
      if (json instanceof Error) throw json;
      return { json, latencyMs: 24000, costUsd: 0.03 };
    },
  };
  return { d, calls, tracker };
}

/** A retried review spends twice: every call that answered is on the tracker, and the spike total counts both. */
function assertReviewSpend(tracker: ReturnType<typeof createUsageTracker>, n: number) {
  const reviews = tracker.records().filter((r) => r.step === "review");
  assert.equal(reviews.length, n, `${n} review usage record(s)`);
  for (const r of reviews) assert.equal(r.costUsd, 0.03);
  assert.equal(tracker.totals().calls, n, "every call that answered is counted");
  assert.equal(tracker.totals().spikeTotalUsd, Math.round(n * 0.03 * 10000) / 10000, "the spike total counts each try");
}

test("planted problem: the reviewer marks the smell as not backed, the plan line says 2 of 3", async () => {
  const { d, calls, tracker } = deps([plantedAnswer]);
  const review = await runReview(input, d);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].images, input.frames.map((f) => f.dataUrl), "photos go out in attach order");
  assert.equal(calls[0].schema, REVIEW_SCHEMA);
  assert.equal(review.ran, true);
  assert.equal(verdictFor(review, { rank: 2 })?.verified, false);
  assert.match(verdictFor(review, { rank: 2 })?.reason ?? "", /smell/i);
  assert.equal(verdictFor(review, { rank: 1 })?.verified, true);
  assert.deepEqual(reviewTally(review), { verified: 2, total: 3 });
  assert.equal(reviewLine(review), "Reviewed by a separate check: 2 of 3 problems backed by a photo.");
  assert.equal(tracker.records().filter((r) => r.step === "review").length, 1);
});

test("planted problem: an invalid first answer is retried once with a fix-up note, then accepted", async () => {
  const { d, calls, tracker } = deps(["not json at all", plantedAnswer]);
  const review = await runReview(input, d);
  assert.equal(calls.length, 2);
  assert.match(calls[1].prompt, /failed validation/);
  assert.deepEqual(reviewTally(review), { verified: 2, total: 3 });
  assertReviewSpend(tracker, 2);
});

test("planted problem: a reviewer that invents an id or repeats one can't flip a verdict", async () => {
  const { d } = deps([{ ...plantedAnswer, items: [...plantedAnswer.items, { problemId: "2", verified: true, reason: "late flip" }, { problemId: "9", verified: false, reason: "made up" }] }]);
  const review = await runReview(input, d);
  assert.equal(review.items.length, 3);
  assert.equal(verdictFor(review, { rank: 2 })?.verified, false, "first answer wins");
});

test("planted problem: a provider error leaves the plan standing with Review didn't run", async () => {
  const { d, calls, tracker } = deps([new Error("504 from provider")]);
  const review = await runReview(input, d);
  assert.equal(calls.length, 1, "no retry after a thrown call");
  assertReviewSpend(tracker, 0);
  assert.deepEqual(review, { ran: false, items: [] });
  assert.match(reviewLine(review) ?? "", /^Review didn't run/);
});

test("REVIEW_SCHEMA requires ran and items, so a schema-true answer parses on the first call", async () => {
  const schema = REVIEW_SCHEMA as { required?: string[]; properties?: Record<string, { type?: string }> };
  assert.deepEqual([...(schema.required ?? [])].sort(), ["items", "ran"]);
  assert.equal(schema.properties?.ran?.type, "boolean");
  const { d, calls } = deps([plantedAnswer]);
  const review = await runReview(input, d);
  assert.equal(calls.length, 1, "no retry for a schema-true answer");
  assert.equal(review.ran, true);
  assert.deepEqual(reviewTally(review), { verified: 2, total: 3 });
});

test("an answer missing ran (off schema) is retried once, then the plan says Review didn't run", async () => {
  const { ran: _ran, ...noRan } = plantedAnswer;
  const { d, calls, tracker } = deps([noRan, noRan]);
  const review = await runReview(input, d);
  assert.equal(calls.length, 2);
  assert.deepEqual(review, { ran: false, items: [] });
  assertReviewSpend(tracker, 2);
});

test("a repeated proof photo (two frames, same frameIndex) is refused before any call: ran:false, nothing spent", async () => {
  const dup: ReviewInput = { ...input, frames: [{ frameIndex: 4, dataUrl: png(4) }, { frameIndex: 4, dataUrl: png(7) }] };
  const { d, calls, tracker } = deps([plantedAnswer]);
  const review = await runReview(dup, d);
  assert.equal(calls.length, 0, "no call is spent on a repeated photo");
  assertReviewSpend(tracker, 0);
  assert.deepEqual(review, { ran: false, items: [] });
  assert.match(reviewLine(review) ?? "", /^Review didn't run/);
});

test("distinct frames on the same input still spend exactly one call", async () => {
  const two: ReviewInput = { ...input, frames: [{ frameIndex: 4, dataUrl: png(4) }, { frameIndex: 5, dataUrl: png(5) }] };
  const { d, calls, tracker } = deps([plantedAnswer]);
  const review = await runReview(two, d);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].images.length, 2);
  assert.equal(review.ran, true);
  assertReviewSpend(tracker, 1);
});
