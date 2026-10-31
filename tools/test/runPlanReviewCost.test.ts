/**
 * runPlan reviewing step: the final plan's meta must count the review
 * call (f6b43e7). The final meta was computed before reviewing, so a
 * reviewed run's meta.costUsd missed the review spend and meta.models
 * missed the review model, and the run-cost line undercounted. Every
 * model caller here is a stub and fetch throws; no live calls.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker, type UsageTracker } from "@/lib/pipeline/usage";
import type { ReviewSparkCaller } from "@/lib/pipeline/review";
import { buildReviewPrompt } from "@/lib/reviewPrompt";
import type { PlanRequest, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const S = sanctuary as unknown as WorkPlan;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanReviewCost.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

/** A reviewer that verifies every problem the prompt lists, for a fixed cost. */
function verifyingReviewer(costUsd: number): ReviewSparkCaller {
  return async (req) => {
    const ids = req.prompt
      .split("\n")
      .filter((l) => l.startsWith("id "))
      .map((l) => l.split(" | ")[0].slice(3));
    return {
      json: {
        ran: true,
        items: ids.map((id) => ({ problemId: id, verified: true, reason: "The photo shows it." })),
      },
      latencyMs: 1,
      costUsd,
    };
  };
}

async function run(review?: ReviewSparkCaller): Promise<{ plan: WorkPlan; tracker: UsageTracker }> {
  const tracker = createUsageTracker();
  const request: PlanRequest = {
    spaceName: S.spaceName,
    spaceType: "sanctuary",
    durationSec: 48,
    frames: (S.frames ?? []).map((f) => ({ tSec: f.tSec, dataUrl: JPEG })),
    transcript: null,
    transcriptTurns: [],
  };
  const noCall = async () => {
    throw new Error("offline test: this caller must not run");
  };
  const deps: RunPlanDeps = {
    tracker,
    transcribe: { callTranscribe: noCall as never, tracker },
    segment: { callSegment: async () => ({ instances: [], latencyMs: 1, costUsd: 0 }), tracker },
    reason: {
      prompt: "offline",
      schema: REASON_SCHEMA,
      tracker,
      callSpark: async () => ({
        json: {
          spaceName: S.spaceName,
          generatedFrom: S.generatedFrom,
          inventory: S.inventory,
          issues: S.issues,
          materials: S.materials,
          workOrder: S.workOrder,
          transcriptSummary: null,
          saidVsSeen: [],
          heroFrameIndex: S.heroFrameIndex,
        },
        latencyMs: 1,
        costUsd: 0,
      }),
    },
    cost: { prompt: "unused", schema: {}, tracker, callSpark: noCall as never },
    renderAfter: {
      imageModel: "offline",
      tracker,
      callImage: (async () => ({ images: [JPEG], latencyMs: 1, costUsd: 0 })) as never,
    },
    ...(review ? { review: { callSpark: review }, reviewPrompt: buildReviewPrompt } : {}),
  };
  const plan = await runPlan(request, deps);
  return { plan, tracker };
}

describe("runPlan reviewing step: review spend in plan.meta (offline)", () => {
  test("a reviewed plan's meta counts the review call's cost and model", async () => {
    const { plan, tracker } = await run(verifyingReviewer(0.03));
    assert.equal(plan.review?.ran, true);
    assert.equal(plan.meta?.costUsd, 0.03);
    assert.equal(tracker.totals().spikeTotalUsd, 0.03);
    assert.equal((plan.meta?.models as Record<string, string> | undefined)?.review, "muse-spark-1.3");
  });

  test("a billed-but-failed review still counts in meta, and the plan still ships", async () => {
    const billed = Object.assign(new Error("offline test: reviewer down"), {
      costUsd: 0.02,
      latencyMs: 1,
    });
    const { plan } = await run(async () => {
      throw billed;
    });
    assert.equal(plan.review?.ran, false);
    assert.equal(plan.meta?.costUsd, 0.02);
  });

  test("a plain failed review adds no phantom spend to meta", async () => {
    const { plan } = await run(async () => {
      throw new Error("offline test: reviewer down");
    });
    assert.equal(plan.review?.ran, false);
    assert.equal(plan.meta?.costUsd, 0);
  });
});
