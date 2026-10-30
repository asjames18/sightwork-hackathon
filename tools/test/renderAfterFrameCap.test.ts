/** renderAfter frame cap (6971c30): a plan frame over 5 MB decoded throws at validation before any Image call; exactly 5 MB passes. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runRenderAfter, validateRenderAfterInput, type RenderAfterDeps } from "@/lib/pipeline/renderAfter";
import type { WorkPlan } from "@/lib/types";

const MB5 = 5 * 1024 * 1024;

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const SMALL = jpegDataUrl(64);

/** Minimal plan: frames only, no issues or steps, so a run that passes validation skips with no-visible-changes. */
function plan(urls: string[]): WorkPlan {
  return {
    frames: urls.map((url, i) => ({ index: i, tSec: i, url })),
    issues: [],
    workOrder: [],
  } as unknown as WorkPlan;
}

/** Deps that pass validateRenderAfterDeps with an Image caller that counts and throws. */
function deps(): { deps: RenderAfterDeps; calls: () => number } {
  let n = 0;
  return {
    deps: {
      imageModel: "test-image",
      callImage: async () => {
        n += 1;
        throw new Error("test: Image caller reached");
      },
      tracker: { record: () => {}, totals: () => ({ spikeTotalUsd: 0 }) },
    } as unknown as RenderAfterDeps,
    calls: () => n,
  };
}

describe("renderAfter frame cap", () => {
  test("a frame of 5 MB + 1 byte throws before any Image call", async () => {
    const d = deps();
    await assert.rejects(
      runRenderAfter({ plan: plan([jpegDataUrl(MB5 + 1)]) }, d.deps),
      /renderAfter: plan\.frames\[0\]\.url must be at most 5 MB/,
    );
    assert.equal(d.calls(), 0);
  });

  test("the error reports the decoded byte count", () => {
    assert.throws(() => validateRenderAfterInput({ plan: plan([jpegDataUrl(MB5 + 1)]) }), new RegExp(`got ${MB5 + 1} bytes`));
  });

  test("exactly 5 MB passes validation", () => {
    assert.doesNotThrow(() => validateRenderAfterInput({ plan: plan([jpegDataUrl(MB5)]) }));
  });

  test("an over-cap second frame names frames[1]", () => {
    assert.throws(
      () => validateRenderAfterInput({ plan: plan([SMALL, jpegDataUrl(MB5 + 1)]) }),
      /renderAfter: plan\.frames\[1\]\.url must be at most 5 MB/,
    );
  });

  test("non-data and non-base64 URLs are not sized", () => {
    assert.doesNotThrow(() => validateRenderAfterInput({ plan: plan(["https://example.com/frame.jpg", "/frames/0.jpg"]) }));
    assert.doesNotThrow(() => validateRenderAfterInput({ plan: plan(["data:image/jpeg;base64,***not-base64***"]) }));
  });

  test("a small frame passes and the run skips cleanly with zero Image calls", async () => {
    const d = deps();
    const out = await runRenderAfter({ plan: plan([SMALL]) }, d.deps);
    assert.equal(out.afterImageUrl, null);
    assert.equal(out.skipped, "no-visible-changes");
    assert.equal(d.calls(), 0);
  });
});
