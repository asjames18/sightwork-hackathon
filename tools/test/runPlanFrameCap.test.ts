/** runPlan frame cap (db74e0d): a frame over 5 MB decoded throws at validation before any step runs; exactly 5 MB passes. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runPlan, validateRunPlanRequest, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const MB5 = 5 * 1024 * 1024;

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const SMALL = jpegDataUrl(64);

function req(frames: string[]): PlanRequest {
  return { durationSec: 10, frames: frames.map((dataUrl, i) => ({ tSec: i, dataUrl })) };
}

/**
 * Deps that pass validateRunPlanDeps, with every step caller counting and
 * throwing, and an onStatus that throws on the first stage, so a run that
 * gets past validation stops at "listening" and no real step can run.
 */
function deps(): { deps: RunPlanDeps; calls: () => number; statuses: () => number } {
  let n = 0;
  let s = 0;
  const hit = async () => {
    n += 1;
    throw new Error("test: step caller reached");
  };
  const stepDeps = new Proxy({}, { get: (_t, k) => (k === "tracker" ? { record: () => {}, totals: () => ({ spikeTotalUsd: 0 }) } : hit) });
  return {
    deps: {
      transcribe: stepDeps,
      segment: stepDeps,
      reason: stepDeps,
      cost: stepDeps,
      renderAfter: stepDeps,
      tracker: { record: () => {}, totals: () => ({ spikeTotalUsd: 0 }) },
      onStatus: () => {
        s += 1;
        throw new Error("test: first stage reached");
      },
    } as unknown as RunPlanDeps,
    calls: () => n,
    statuses: () => s,
  };
}

describe("runPlan frame cap", () => {
  test("a frame of 5 MB + 1 byte throws before any stage or step", async () => {
    const d = deps();
    await assert.rejects(runPlan(req([jpegDataUrl(MB5 + 1)]), d.deps), /runPlan: frames\[0\]\.dataUrl must be at most 5 MB/);
    assert.equal(d.statuses(), 0);
    assert.equal(d.calls(), 0);
  });

  test("a frame of exactly 5 MB passes validation and reaches the first stage", async () => {
    const d = deps();
    assert.doesNotThrow(() => validateRunPlanRequest(req([jpegDataUrl(MB5)])));
    await assert.rejects(runPlan(req([jpegDataUrl(MB5)]), d.deps), /first stage reached/);
    assert.equal(d.statuses(), 1);
    assert.equal(d.calls(), 0);
  });

  test("an over-cap second frame names frames[1] and runs no stage", async () => {
    const d = deps();
    await assert.rejects(runPlan(req([SMALL, jpegDataUrl(MB5 + 1)]), d.deps), /runPlan: frames\[1\]\.dataUrl must be at most 5 MB/);
    assert.equal(d.statuses(), 0);
    assert.equal(d.calls(), 0);
  });

  test("the error reports the decoded byte count", () => {
    assert.throws(() => validateRunPlanRequest(req([jpegDataUrl(MB5 + 1)])), {
      message: `runPlan: frames[0].dataUrl must be at most 5 MB, got ${MB5 + 1} bytes`,
    });
  });

  test("a small frame passes validation", () => {
    assert.doesNotThrow(() => validateRunPlanRequest(req([SMALL])));
  });
});
