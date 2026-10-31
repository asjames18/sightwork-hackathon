/** renderAfter image spend: a billed image failure is recorded before
 * the outer catch reports model-failure, so the route total counts it;
 * a plain image failure records nothing; and a tracker throw on the
 * failed record reports cap-exceeded with no image. The image leg of
 * the failed-call series, matching the judge leg. No network. */
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

/** 3 frames, hero 0, one visible step fixing the rank-1 issue on frame 0. */
function plan(): WorkPlan {
  return {
    heroFrameIndex: 0,
    frames: Array.from({ length: 3 }, (_, i) => ({ index: i, tSec: i, url: FIRST })),
    issues: [{ rank: 1, frameIndex: 0 }],
    workOrder: [{ order: 1, title: "Repaint the wall", detail: "", fixes: [1] }],
  } as unknown as WorkPlan;
}

/** Deps with the given image caller and tracker, no judge. */
function deps(
  callImage: RenderAfterDeps["callImage"],
  tracker: UsageTracker,
): RenderAfterDeps {
  return {
    imageModel: "test-image",
    callImage,
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

describe("renderAfter image spend", () => {
  test("a billed image throw is recorded, then model-failure with no image", async () => {
    const tracker = createUsageTracker();
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw billedError("image parse failed", 0.05, 100);
      }, tracker),
    );
    assert.equal(out.afterImageUrl, null);
    assert.equal(out.skipped, "model-failure");
    assert.equal(tracker.totals().spikeTotalUsd, 0.05);
    assert.deepEqual(
      tracker.records().map((r) => [r.step, r.costUsd]),
      [["renderAfter", 0.05]],
    );
  });

  test("a plain image throw records nothing, still model-failure", async () => {
    const tracker = createUsageTracker();
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw new Error("image unavailable");
      }, tracker),
    );
    assert.equal(out.afterImageUrl, null);
    assert.equal(out.skipped, "model-failure");
    assert.equal(tracker.totals().spikeTotalUsd, 0);
    assert.equal(tracker.records().length, 0);
  });

  test("a tracker throw on the failed image record reports cap-exceeded", async () => {
    const stub = {
      record: () => {
        throw new Error("usage: spike cap exceeded");
      },
    } as unknown as UsageTracker;
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw billedError("image parse failed", 0.05, 100);
      }, stub),
    );
    assert.equal(out.afterImageUrl, null);
    assert.equal(out.skipped, "cap-exceeded");
  });

  test("a successful image still ships with its spend recorded", async () => {
    const tracker = createUsageTracker();
    const out = await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => ({ images: [FIRST], latencyMs: 10, costUsd: 0.1 }), tracker),
    );
    assert.equal(out.afterImageUrl, FIRST);
    assert.equal(out.skipped, undefined);
    assert.equal(tracker.totals().spikeTotalUsd, 0.1);
  });
});
