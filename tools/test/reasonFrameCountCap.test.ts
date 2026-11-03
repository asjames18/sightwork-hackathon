/** Reason step frame-count cap: 49 frames throw before any Spark call;
 * exactly 48 reach callSpark. Parity with the route's MAX_PLAN_FRAMES
 * (48): the meta path hands the reason step every request frame, so a
 * direct runReason caller with 49+ frames used to ride onto a paid
 * Spark call with more images than any real run sends. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runReason, validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

/** Small JPEG data URL (SOI header, 64 decoded bytes). */
const SMALL = (() => {
  const buf = Buffer.alloc(64);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
})();

function input(count: number): ReasonInput {
  return {
    frames: Array.from({ length: count }, (_, i) => ({ tSec: i, dataUrl: SMALL })),
    segmentation: null,
    transcript: null,
    durationSec: count,
  };
}

/** Deps whose callSpark counts calls and always throws, so no real call can happen. */
function deps(): { deps: ReasonDeps; calls: () => number } {
  let n = 0;
  return {
    deps: {
      prompt: "p",
      schema: {},
      callSpark: async () => {
        n += 1;
        throw new Error("test: callSpark reached");
      },
      tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
    },
    calls: () => n,
  };
}

describe("reason step frame-count cap", () => {
  test("49 frames throw before any Spark call", async () => {
    const d = deps();
    await assert.rejects(runReason(input(49), d.deps), /frames must not exceed 48/);
    assert.equal(d.calls(), 0);
  });

  test("exactly 48 frames pass validation and reach callSpark", async () => {
    const d = deps();
    assert.doesNotThrow(() => validateReasonRequest(input(48), d.deps));
    await assert.rejects(runReason(input(48), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });

  test("a small frame list passes validation", () => {
    assert.doesNotThrow(() => validateReasonRequest(input(1), deps().deps));
  });
});
