/**
 * runPlan survives a failed transcribe call (offline):
 * the run continues without narration and the finished plan carries
 * meta.skipped.transcribe, which the panel's Listen row already
 * renders as off. A spike-cap throw still fails the run at
 * listening instead of continuing to steps that would spend more.
 * Every model caller is a stub except the transcribe caller, which
 * throws; fetch throws. No live calls.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, PlanStepError, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker, type UsageTracker } from "@/lib/pipeline/usage";
import type { SegmentCaller } from "@/lib/pipeline/segment";
import type { PlanJobStatus, PlanRequest, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
// Minimal mono s16le WAV at 16000 Hz, no samples: passes the
// runPlan audio validator and runTranscribe's header checks, so the
// only failure in the run is the stubbed transcribe caller.
const WAV =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";
const S = sanctuary as unknown as WorkPlan;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanTranscribeFallback.test: no network allowed");
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

async function run(
  transcribeError: Error,
): Promise<{ plan: WorkPlan; tracker: UsageTracker; statuses: PlanJobStatus[] }> {
  const tracker = createUsageTracker();
  const statuses: PlanJobStatus[] = [];
  const deps: RunPlanDeps = {
    tracker,
    transcribe: {
      callTranscribe: (async () => {
        throw transcribeError;
      }) as never,
      tracker,
    },
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
    onStatus: (status) => {
      statuses.push(status);
    },
  };
  const request: PlanRequest = {
    spaceName: S.spaceName,
    spaceType: "sanctuary",
    durationSec: 48,
    frames: (S.frames ?? []).map((f) => ({ tSec: f.tSec, dataUrl: JPEG })),
    audioWavBase64: WAV,
    region: "Sebring, FL",
  };
  const plan = await runPlan(request, deps);
  return { plan, tracker, statuses };
}

describe("runPlan transcribe fallback (offline)", () => {
  test("a failed transcribe call ships the plan without narration and flags skipped.transcribe", async () => {
    const { plan, statuses } = await run(new Error("transcribe: provider failed"));
    assert.equal(plan.transcript, null);
    assert.deepEqual(plan.transcriptTurns, []);
    assert.equal(plan.meta?.skipped?.transcribe, true);
    // The failed call recorded nothing, so no transcribe model key.
    assert.equal(plan.meta?.models?.transcribe, undefined);
    // The rest of the run still happened: ranked issues carried.
    assert.ok(plan.issues.length > 0);
    assert.equal(plan.issues.length, S.issues.length);
    // The listening check says transcription was unavailable, not
    // that nobody spoke.
    const listeningCheck = statuses.find(
      (s) => s.state === "running" && s.step === "listening" && s.check,
    );
    assert.ok(listeningCheck && listeningCheck.state === "running");
    assert.equal(listeningCheck.check?.note, "Transcription unavailable this run");
  });

  test("a spike-cap throw still fails the run at listening", async () => {
    await assert.rejects(
      () => run(new Error("transcribe: spike cap exceeded")),
      (err: unknown) => {
        assert.ok(err instanceof PlanStepError);
        assert.equal(err.step, "listening");
        return true;
      },
    );
  });
});
