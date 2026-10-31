/**
 * runPlan fills plan.meta from the usage tracker (offline):
 * models names each step that actually called, region carries the
 * requested region, and costUsd is the spike total. A step that never
 * ran records no model: with a transcript supplied, transcribe is
 * skipped, so models has no transcribe key. Every model caller is a
 * stub and fetch throws. No live calls.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker, type UsageTracker } from "@/lib/pipeline/usage";
import type { SegmentCaller } from "@/lib/pipeline/segment";
import type { PlanRequest, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const S = sanctuary as unknown as WorkPlan;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanMetaModels.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

/** The stored real plan's reason fields, as the model would return them. */
function reasonJson(): unknown {
  return JSON.parse(
    JSON.stringify({
      spaceName: S.spaceName,
      generatedFrom: S.generatedFrom,
      inventory: S.inventory,
      issues: S.issues,
      materials: S.materials,
      workOrder: S.workOrder,
      transcriptSummary: null,
      saidVsSeen: [],
      heroFrameIndex: S.heroFrameIndex,
    }),
  );
}

/** Cost model JSON: material 0 search-grounded, material 1 estimated. */
function costJson(): unknown {
  return {
    unitCosts: [
      { materialIndex: 0, unit: "piece", unitCost: [10, 20], grounded: true },
      { materialIndex: 1, unit: "roll", unitCost: [5, 9], grounded: false },
    ],
    laborRate: [40, 80],
    contingencyPct: [10, 15],
    assumptions: ["Mid-grade"],
    sources: [],
  };
}

const sam: SegmentCaller = async () => ({ instances: [], latencyMs: 1, costUsd: 0.0025 });

async function run(): Promise<{ plan: WorkPlan; tracker: UsageTracker }> {
  const tracker = createUsageTracker();
  const noCall = async () => {
    throw new Error("offline test: this caller must not run");
  };
  const deps: RunPlanDeps = {
    tracker,
    transcribe: { callTranscribe: noCall as never, tracker },
    segment: { callSegment: sam, tracker },
    reason: {
      prompt: "offline",
      schema: REASON_SCHEMA,
      tracker,
      callSpark: async () => ({ json: reasonJson(), latencyMs: 1, costUsd: 0.05 }),
    },
    cost: {
      prompt: "unused",
      schema: {},
      tracker,
      callSpark: async () => ({ json: costJson(), latencyMs: 1, costUsd: 0.02 }),
    },
    renderAfter: {
      imageModel: "offline",
      tracker,
      callImage: (async () => ({ images: [JPEG], latencyMs: 1, costUsd: 0.01 })) as never,
    },
    onStatus: () => {},
  };
  const request: PlanRequest = {
    spaceName: S.spaceName,
    spaceType: "sanctuary",
    durationSec: 48,
    frames: (S.frames ?? []).map((f) => ({ tSec: f.tSec, dataUrl: JPEG })),
    transcript: null,
    transcriptTurns: [],
    region: "Sebring, FL",
  };
  const plan = await runPlan(request, deps);
  return { plan, tracker };
}

describe("runPlan plan.meta (offline)", () => {
  test("models name each step that called, region carries, costUsd is the spike total", async () => {
    const { plan, tracker } = await run();
    assert.equal(plan.meta?.models?.segment, "sam-3.1");
    assert.equal(plan.meta?.models?.reason, "muse-spark-1.3");
    assert.equal(plan.meta?.models?.cost, "muse-spark-1.3");
    assert.equal(plan.meta?.region, "Sebring, FL");
    assert.equal(plan.meta?.costUsd, tracker.totals().spikeTotalUsd);
    // Transcript supplied, so the transcribe step never ran: no key.
    assert.equal(plan.meta?.models?.transcribe, undefined);
    // Per-model totals add back to the spike total.
    const byModel = tracker.totalsByModel().reduce((sum, m) => sum + m.totalUsd, 0);
    assert.equal(byModel, tracker.totals().spikeTotalUsd);
    // The image key follows the step: present when an after image
    // rendered, absent when the step skipped.
    if (plan.afterImageUrl) assert.equal(plan.meta?.models?.image, "offline");
    else assert.equal(plan.meta?.models?.image, undefined);
  });
});
