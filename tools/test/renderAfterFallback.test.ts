/** renderAfter hero fallback: the reason step's hero can point at a frame
 * with nothing to fix (real run 2026-10-29: hero 1, both ranked issues on
 * frames 6 and 5), while a ranked issue frame has visible work. The step
 * must fall back to the highest-ranked issue's frame and edit that one,
 * not skip the after image; when no ranked issue frame qualifies it
 * skips cleanly with no Image call. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildVisibleChanges,
  pickFallbackHeroFrameIndex,
  runRenderAfter,
  type RenderAfterDeps,
} from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const SMALL = jpegDataUrl(64);

/** 7 frames, hero 1, ranked issues on frames 6 (rank 1) and 5 (rank 2). */
function plan(stepTitles: [string, number][]): WorkPlan {
  return {
    heroFrameIndex: 1,
    frames: Array.from({ length: 7 }, (_, i) => ({ index: i, tSec: i, url: SMALL })),
    issues: [
      { rank: 1, frameIndex: 6 },
      { rank: 2, frameIndex: 5 },
    ],
    workOrder: stepTitles.map(([title, rank], i) => ({
      order: i + 1,
      title,
      detail: "",
      fixes: [rank],
    })),
  } as unknown as WorkPlan;
}

/** Deps with an Image caller that counts calls and returns one usable image. */
function deps(): { deps: RenderAfterDeps; calls: () => number; prompts: () => string[] } {
  let n = 0;
  const prompts: string[] = [];
  return {
    deps: {
      imageModel: "test-image",
      callImage: async (req: { prompt: string }) => {
        n += 1;
        prompts.push(req.prompt);
        return { images: [SMALL], latencyMs: 1, costUsd: 0 };
      },
      tracker: { record: () => {}, totals: () => ({ spikeTotalUsd: 0 }) },
    } as unknown as RenderAfterDeps,
    calls: () => n,
    prompts: () => prompts,
  };
}

describe("renderAfter hero fallback", () => {
  test("the picked hero has no visible changes, so the fallback is frame 6, not 5", () => {
    const p = plan([
      ["Repaint the wall", 1],
      ["Replace the light fixture", 2],
    ]);
    assert.deepEqual(buildVisibleChanges(p, 1), []);
    assert.equal(pickFallbackHeroFrameIndex(p, 1), 6);
  });

  test("a run with a dead hero edits the fallback frame with one Image call", async () => {
    const p = plan([
      ["Repaint the wall", 1],
      ["Replace the light fixture", 2],
    ]);
    const d = deps();
    const out = await runRenderAfter({ plan: p, spaceType: "room" }, d.deps);
    assert.equal(out.heroFrameIndex, 6);
    assert.deepEqual(out.visibleChanges, ["Repaint the wall"]);
    assert.equal(out.afterImageUrl, SMALL);
    assert.equal(out.skipped, undefined);
    assert.equal(d.calls(), 1);
    assert.match(d.prompts()[0], /Repaint the wall/);
  });

  test("no qualifying ranked frame skips with no-visible-changes and zero Image calls", async () => {
    // A hidden-only step (inspection above the ceiling) yields no visible
    // changes on any frame, so neither the hero nor any fallback qualifies.
    const p = plan([["Inspect above the ceiling", 1]]);
    assert.equal(pickFallbackHeroFrameIndex(p, 1), null);
    const d = deps();
    const out = await runRenderAfter({ plan: p, spaceType: "room" }, d.deps);
    assert.equal(out.afterImageUrl, null);
    assert.equal(out.heroFrameIndex, 1);
    assert.equal(out.skipped, "no-visible-changes");
    assert.equal(d.calls(), 0);
  });
});
