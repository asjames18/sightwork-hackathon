/**
 * runPlan carries the cost step's price counts through to the finished plan (offline):
 * with a region, the plan's costRange.pricing must be { priced, grounded } from
 * computeCostRange, so the planning check note can say how many prices were looked up live.
 * Every model caller is a stub and fetch throws. No live calls.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker } from "@/lib/pipeline/usage";
import type { SegmentCaller } from "@/lib/pipeline/segment";
import { pricingNote, stepChecksForPlan } from "@/lib/stepChecks";
import type { PlanJobStatus, PlanRequest, StepCheck, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const S = sanctuary as unknown as WorkPlan;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanPricingCounts.test: no network allowed");
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

const sam: SegmentCaller = async () => ({ instances: [], latencyMs: 1, costUsd: 0 });

async function run(): Promise<{ plan: WorkPlan; statuses: PlanJobStatus[] }> {
  const tracker = createUsageTracker();
  const statuses: PlanJobStatus[] = [];
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
      callSpark: async () => ({ json: reasonJson(), latencyMs: 1, costUsd: 0 }),
    },
    cost: {
      prompt: "unused",
      schema: {},
      tracker,
      callSpark: async () => ({ json: costJson(), latencyMs: 1, costUsd: 0 }),
    },
    renderAfter: {
      imageModel: "offline",
      tracker,
      callImage: (async () => ({ images: [JPEG], latencyMs: 1, costUsd: 0 })) as never,
    },
    onStatus: (s) => statuses.push(s),
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
  return { plan, statuses };
}

describe("runPlan price counts (offline)", () => {
  test("a regioned run carries priced/grounded onto costRange.pricing and the planning note", async () => {
    const { plan, statuses } = await run();
    assert.deepEqual(plan.costRange?.pricing, { priced: 2, grounded: 1 });
    assert.equal(pricingNote(plan), "1 of 2 prices looked up live");
    const planning = statuses
      .filter((s) => s.state === "running" && (s as { check?: StepCheck }).check)
      .map((s) => (s as { check: StepCheck }).check)
      .find((c) => c.note.includes("prices looked up live"));
    assert.ok(planning, "a streamed planning check carries the looked-up line");
    assert.equal(planning.note, stepChecksForPlan(plan).planning?.note);
  });
});
