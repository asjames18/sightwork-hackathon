/** renderAfter judge spend: a billed judge failure is recorded before
 * the first-candidate fallback, so the route total counts it; a plain
 * judge failure records nothing; a tracker throw on the failed record
 * is warned, not a spending stop (the image already exists); and a
 * spike-cap judge throw still reports cap-exceeded with no image.
 * No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  runRenderAfter,
  type RenderAfterDeps,
} from "@/lib/pipeline/renderAfter";
import {
  createUsageTracker,
  type UsageTracker,
} from "@/lib/pipeline/usage";
import type { WorkPlan } from "@/lib/types";

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const FIRST = jpegDataUrl(64);
const SECOND = jpegDataUrl(128);

/** 3 frames, hero 0, one visible step fixing the rank-1 issue on frame 0. */
function plan(): WorkPlan {
  return {
    heroFrameIndex: 0,
    frames: Array.from({ length: 3 }, (_, i) => ({ index: i, tSec: i, url: FIRST })),
    issues: [{ rank: 1, frameIndex: 0 }],
    workOrder: [{ order: 1, title: "Repaint the wall", detail: "", fixes: [1] }],
  } as unknown as WorkPlan;
}

/** Deps asking for 2 candidates with the given judge caller and tracker. */
function deps(
  callJudge: RenderAfterDeps["callJudge"],
  tracker: UsageTracker,
): RenderAfterDeps {
  return {
    imageModel: "test-image",
    callImage: async () => ({ images: [FIRST, SECOND], latencyMs: 10, costUsd: 0.1 }),
    judgeModel: "test-judge",
    callJudge,
    generateTwo: true,
    tracker,
  } as unknown as RenderAfterDeps;
}

/** An Error carrying billed spend, as MetaCallError does on a failed call. */
function billedError(message: string, costUsd: number, latencyMs: number): Error {
  const err = new Error(message) as Error & { costUsd: number; latencyMs: number };
  err.costUsd = costUsd;
  err.latencyMs = latencyMs;
  return err;
}

describe("renderAfter judge spend", () => {
  test("a billed judge throw is recorded, then the first candidate ships", async () => {
    const tracker = createUsageTracker();
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw billedError("judge parse failed", 0.05, 100);
      }, tracker),
    );
    assert.equal(out.afterImageUrl, FIRST);
    assert.equal(out.skipped, undefined);
    assert.equal(tracker.totals().spikeTotalUsd, 0.15);
    assert.deepEqual(
      tracker.records().map((r) => [r.step, r.costUsd]),
      [
        ["renderAfter", 0.1],
        ["renderAfterJudge", 0.05],
      ],
    );
  });

  test("a plain judge throw records nothing, first candidate still ships", async () => {
    const tracker = createUsageTracker();
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw new Error("judge unavailable");
      }, tracker),
    );
    assert.equal(out.afterImageUrl, FIRST);
    assert.equal(tracker.totals().spikeTotalUsd, 0.1);
    assert.equal(tracker.records().length, 1);
  });

  test("a tracker throw on the failed judge record still ships the first candidate", async () => {
    const stub = {
      record: (input: { step: string }) => {
        if (input.step === "renderAfterJudge") throw new Error("usage: spike cap exceeded");
        return { model: "test-image", step: input.step, latencyMs: 10, costUsd: 0.1, at: new Date().toISOString() };
      },
    } as unknown as UsageTracker;
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw billedError("judge parse failed", 0.05, 100);
      }, stub),
    );
    assert.equal(out.afterImageUrl, FIRST);
    assert.equal(out.skipped, undefined);
  });

  test("a spike-cap judge throw still reports cap-exceeded with no image", async () => {
    const tracker = createUsageTracker();
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw new Error("spike cap exceeded");
      }, tracker),
    );
    assert.equal(out.afterImageUrl, null);
    assert.equal(out.skipped, "cap-exceeded");
  });

  test("a successful judge pick still wins the second candidate", async () => {
    const tracker = createUsageTracker();
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => ({ json: { pick: 3 }, latencyMs: 5, costUsd: 0.02 }), tracker),
    );
    assert.equal(out.afterImageUrl, SECOND);
    assert.equal(tracker.totals().spikeTotalUsd, 0.12);
  });
});
