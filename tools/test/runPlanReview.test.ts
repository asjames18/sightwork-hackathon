/**
 * runPlan reviewing step (e9ba569) with the real prompt 06 builder, end to end and offline: every
 * model caller is a stub and fetch throws. A planted problem the photos can't show (a smell) comes
 * back unverified, the plan line reads "N-1 of N", the reviewer sees the filled prompt and the
 * selected photos, and a failed review still ships the plan with "Review didn't run".
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker, type UsageTracker } from "@/lib/pipeline/usage";
import type { ReviewSparkCaller } from "@/lib/pipeline/review";
import { buildReviewPrompt } from "@/lib/reviewPrompt";
import { reviewLine, planReview, verdictFor } from "@/lib/review";
import type { PlanJobStatus, PlanRequest, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const S = sanctuary as unknown as WorkPlan;
const SMELL = "Musty smell behind the stage curtain";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanReview.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

const request: PlanRequest = {
  spaceName: S.spaceName,
  spaceType: "sanctuary",
  durationSec: 48,
  frames: (S.frames ?? []).map((f) => ({ tSec: f.tSec, dataUrl: JPEG })),
  transcript: null,
  transcriptTurns: [],
};

/** The stored real plan's reason fields, plus one planted problem no photo can show. */
function reasonJson(): unknown {
  const issues = JSON.parse(JSON.stringify(S.issues));
  issues.push({
    ...issues[issues.length - 1],
    rank: issues.length + 1,
    title: SMELL,
    detail: "A damp, musty smell near the back curtain.",
    severity: "medium",
    frameIndex: 2,
    frameTimeSec: S.frames?.[2]?.tSec ?? 10,
    proofFrames: [{ frameIndex: 2, tSec: S.frames?.[2]?.tSec ?? 10 }],
  });
  return {
    spaceName: S.spaceName,
    generatedFrom: S.generatedFrom,
    inventory: S.inventory,
    issues,
    materials: S.materials,
    workOrder: S.workOrder,
    transcriptSummary: null,
    saidVsSeen: [],
    heroFrameIndex: S.heroFrameIndex,
  };
}

/** A reviewer that follows prompt 06: every problem is seen except the smell. */
function honestReviewer(calls: { prompt: string; images: string[] }[]): ReviewSparkCaller {
  return async (req) => {
    calls.push({ prompt: req.prompt, images: req.images });
    const ids = req.prompt.split("\n").filter((l) => l.startsWith("id ")).map((l) => ({ id: l.split(" | ")[0].slice(3), smell: l.includes(SMELL) }));
    return {
      json: {
        ran: true,
        items: ids.map(({ id, smell }) => ({
          problemId: id,
          verified: !smell,
          reason: smell ? "A smell can't be seen; Photo A shows only the curtain." : "The photo shows it.",
        })),
      },
      latencyMs: 1,
      costUsd: 0.03,
    };
  };
}

async function run(review?: ReviewSparkCaller): Promise<{ plan: WorkPlan; statuses: PlanJobStatus[]; tracker: UsageTracker }> {
  const tracker = createUsageTracker();
  const statuses: PlanJobStatus[] = [];
  const noCall = async () => {
    throw new Error("offline test: this caller must not run");
  };
  const deps: RunPlanDeps = {
    tracker,
    transcribe: { callTranscribe: noCall as never, tracker },
    segment: { callSegment: async () => ({ instances: [], latencyMs: 1, costUsd: 0 }), tracker },
    reason: { prompt: "offline", schema: REASON_SCHEMA, tracker, callSpark: async () => ({ json: reasonJson(), latencyMs: 1, costUsd: 0 }) },
    cost: { prompt: "unused", schema: {}, tracker, callSpark: noCall as never },
    renderAfter: { imageModel: "offline", tracker, callImage: (async () => ({ images: [JPEG], latencyMs: 1, costUsd: 0 })) as never },
    onStatus: (s) => statuses.push(s),
    ...(review ? { review: { callSpark: review }, reviewPrompt: buildReviewPrompt } : {}),
  };
  const plan = await runPlan(request, deps);
  return { plan, statuses, tracker };
}

describe("runPlan reviewing step with prompt 06 (offline)", () => {
  test("planted smell comes back unverified; the plan line reads N-1 of N", async () => {
    const calls: { prompt: string; images: string[] }[] = [];
    const { plan, statuses, tracker } = await run(honestReviewer(calls));
    assert.equal(calls.length, 1, "one review call per run");
    const smell = plan.issues.find((i) => i.title === SMELL);
    assert.ok(smell, "planted problem survives the reason step");
    const review = planReview(plan);
    assert.equal(review?.ran, true);
    assert.equal(review?.source, "model");
    assert.equal(verdictFor(review, smell)?.verified, false);
    const n = plan.issues.length;
    assert.equal(reviewLine(review), `Reviewed by a separate check: ${n - 1} of ${n} problems backed by a photo.`);
    assert.ok(statuses.some((s) => s.state === "running" && s.step === "reviewing"));
    assert.ok(!statuses.some((s) => s.state === "failed"));
    assert.equal(tracker.records().filter((r) => r.step === "review").length, 1);
  });

  test("the reviewer gets the filled prompt and one image per listed photo", async () => {
    const calls: { prompt: string; images: string[] }[] = [];
    await run(honestReviewer(calls));
    const { prompt, images } = calls[0];
    assert.doesNotMatch(prompt, /\{\{\w+\}\}/);
    assert.match(prompt, /walkthrough video of a sanctuary\./);
    const photoLines = prompt.split("\n").filter((l) => /^Photo [A-H]: frame \d+ at \d+:\d\d$/.test(l));
    assert.ok(photoLines.length > 0 && photoLines.length <= 8);
    assert.equal(images.length, photoLines.length);
    assert.match(prompt, new RegExp(`\\| ${SMELL} \\| .* \\| proof: Photo A$`, "m"));
  });

  test("a review call that throws still ships the plan with Review didn't run", async () => {
    const { plan, statuses } = await run(async () => {
      throw new Error("offline test: reviewer down");
    });
    assert.equal(plan.review?.ran, false);
    assert.match(reviewLine(planReview(plan)) ?? "", /^Review didn't run\./);
    assert.ok(plan.issues.length > 0);
    assert.ok(!statuses.some((s) => s.state === "failed"));
  });

  test("without the review deps the run ends at picturing with no review", async () => {
    const { plan, statuses } = await run();
    assert.equal(plan.review, undefined);
    assert.ok(!statuses.some((s) => "step" in s && s.step === "reviewing"));
  });
});
