/**
 * runPlan cost step: a plan with problems but no work steps, run with a
 * region, must not spend a cost call, and must mark the cost step
 * skipped in plan.meta instead of failing the run. The empty-work-order
 * guard in buildCostPrompt throws inside runPlan's cost try block, so
 * the run keeps costRange null and sets meta.skipped.cost.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA, buildCostPrompt } from "@/lib/pipeline/planPrompts";
import { createUsageTracker } from "@/lib/pipeline/usage";
import type { PlanRequest, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const S = sanctuary as unknown as WorkPlan;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanCostSkippedEmptyWorkOrder.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

describe("runPlan cost step: empty work order with a region (offline)", () => {
  test("no cost call, costRange null, meta.skipped.cost true", async () => {
    const tracker = createUsageTracker();
    const request: PlanRequest = {
      spaceName: S.spaceName,
      spaceType: "sanctuary",
      durationSec: 48,
      frames: (S.frames ?? []).map((f) => ({ tSec: f.tSec, dataUrl: JPEG })),
      transcript: null,
      transcriptTurns: [],
      region: "Sebring, FL",
    };
    const noCall = async () => {
      throw new Error("offline test: this caller must not run");
    };
    let costCalls = 0;
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
            workOrder: [],
            transcriptSummary: null,
            saidVsSeen: [],
            heroFrameIndex: S.heroFrameIndex,
          },
          latencyMs: 1,
          costUsd: 0,
        }),
      },
      cost: {
        prompt: "unused",
        schema: {},
        tracker,
        callSpark: (async () => {
          costCalls += 1;
          throw new Error("offline test: cost caller must not run for an empty work order");
        }) as never,
      },
      costPrompt: buildCostPrompt,
      renderAfter: {
        imageModel: "offline",
        tracker,
        callImage: (async () => ({ images: [JPEG], latencyMs: 1, costUsd: 0 })) as never,
      },
    };
    const plan = await runPlan(request, deps);
    assert.deepEqual(plan.workOrder, []);
    assert.equal(plan.costRange, null);
    assert.equal(plan.meta?.skipped?.cost, true);
    assert.equal(costCalls, 0);
  });
});
