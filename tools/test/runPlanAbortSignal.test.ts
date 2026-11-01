/**
 * runPlan whole-run abort (2026-11-01): the per-leg abort tests prove each
 * step forwards the signal, but nothing proved a stopped run actually
 * stops at runPlan level instead of limping on to later steps. A run
 * whose signal is already aborted throws AbortError before any model
 * call, and a run aborted mid-reason throws AbortError without ever
 * reaching cost, picturing, or review. Fake callers only; no network,
 * no key, no paid call. Mirrors the runPlanReview.test.ts harness.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker } from "@/lib/pipeline/usage";
import type { PlanRequest, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const S = sanctuary as unknown as WorkPlan;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanAbortSignal.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

function reasonJson(): unknown {
  return {
    spaceName: S.spaceName,
    generatedFrom: S.generatedFrom,
    inventory: S.inventory,
    issues: S.issues,
    materials: S.materials,
    workOrder: S.workOrder,
    transcriptSummary: null,
    saidVsSeen: [],
    heroFrameIndex: S.heroFrameIndex,
  };
}

const request: PlanRequest = {
  spaceName: S.spaceName,
  spaceType: "sanctuary",
  durationSec: 48,
  frames: (S.frames ?? []).map((f) => ({ tSec: f.tSec, dataUrl: JPEG })),
  transcript: null,
  transcriptTurns: [],
};

function abortError(): Error {
  const err = new Error("stopped");
  err.name = "AbortError";
  return err;
}

describe("runPlan stops the whole run on abort (offline)", () => {
  test("an already-aborted signal throws before any model call", async () => {
    const counts = { segment: 0, reason: 0, cost: 0, image: 0 };
    const tracker = createUsageTracker();
    const controller = new AbortController();
    controller.abort();
    const deps: RunPlanDeps = {
      tracker,
      transcribe: { callTranscribe: (async () => { throw new Error("must not run"); }) as never, tracker },
      segment: {
        callSegment: (async () => { counts.segment++; return { instances: [], latencyMs: 1, costUsd: 0 }; }) as never,
        tracker,
      },
      reason: {
        prompt: "offline",
        schema: REASON_SCHEMA,
        tracker,
        callSpark: (async () => { counts.reason++; return { json: reasonJson(), latencyMs: 1, costUsd: 0 }; }) as never,
      },
      cost: {
        prompt: "unused",
        schema: {},
        tracker,
        callSpark: (async () => { counts.cost++; throw new Error("must not run"); }) as never,
      },
      renderAfter: {
        imageModel: "offline",
        tracker,
        callImage: (async () => { counts.image++; return { images: [JPEG], latencyMs: 1, costUsd: 0 }; }) as never,
      },
      signal: controller.signal,
    };
    let caught: unknown;
    try {
      await runPlan(request, deps);
    } catch (err) {
      caught = err;
    }
    assert.equal((caught as Error)?.name, "AbortError");
    assert.deepEqual(counts, { segment: 0, reason: 0, cost: 0, image: 0 });
  });

  test("an abort mid-reason stops before cost, picturing, and review", async () => {
    const counts = { segment: 0, reason: 0, cost: 0, image: 0 };
    const tracker = createUsageTracker();
    const controller = new AbortController();
    const deps: RunPlanDeps = {
      tracker,
      transcribe: { callTranscribe: (async () => { throw new Error("must not run"); }) as never, tracker },
      segment: {
        callSegment: (async () => { counts.segment++; return { instances: [], latencyMs: 1, costUsd: 0 }; }) as never,
        tracker,
      },
      reason: {
        prompt: "offline",
        schema: REASON_SCHEMA,
        tracker,
        callSpark: (async () => {
          counts.reason++;
          controller.abort();
          throw abortError();
        }) as never,
      },
      cost: {
        prompt: "unused",
        schema: {},
        tracker,
        callSpark: (async () => { counts.cost++; throw new Error("must not run"); }) as never,
      },
      renderAfter: {
        imageModel: "offline",
        tracker,
        callImage: (async () => { counts.image++; return { images: [JPEG], latencyMs: 1, costUsd: 0 }; }) as never,
      },
      signal: controller.signal,
    };
    let caught: unknown;
    try {
      await runPlan(request, deps);
    } catch (err) {
      caught = err;
    }
    assert.equal((caught as Error)?.name, "AbortError");
    // The segment step's internal call count with an empty-instances
    // fake is not asserted exactly (120 calls in the offline check);
    // the point is it ran and reason ran once.
    assert.ok(counts.segment > 0);
    assert.equal(counts.reason, 1);
    assert.equal(counts.cost, 0);
    assert.equal(counts.image, 0);
  });
});
