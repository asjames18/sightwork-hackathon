/** Reason step validator (validateReasonRequest) frame duration: a direct
 * runReason caller bypassing the route validator gets the same
 * fail-fast as the route's frames — a frame timestamp past durationSec
 * would mislabel a proof frame as coming from inside a video that had
 * already ended. Real runs are already in range (runPlan hands the
 * reason step the route-validated frames), so no current run changes,
 * and a frame exactly at durationSec passes like the route's frames.
 * No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function input(tSecs: number[]): ReasonInput {
  return {
    frames: tSecs.map((tSec) => ({ tSec, dataUrl: PNG_1PX })),
    segmentation: null,
    transcript: null,
    durationSec: 60,
  };
}

function deps(): ReasonDeps {
  return {
    prompt: "p",
    schema: {},
    callSpark: async () => {
      throw new Error("test: callSpark reached");
    },
    tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
  };
}

test("a frame past durationSec is rejected", () => {
  assert.throws(() => validateReasonRequest(input([0, 61]), deps()), {
    message: "reason: frame 1 tSec must not exceed durationSec",
  });
});

test("frames at or before durationSec pass", () => {
  assert.doesNotThrow(() => validateReasonRequest(input([0, 60]), deps()));
  assert.doesNotThrow(() => validateReasonRequest(input([0, 30]), deps()));
});

test("a malformed frame keeps its own message", () => {
  assert.throws(() => validateReasonRequest(input([61, -1]), deps()), {
    message: "reason: frame 1 has no valid tSec/dataUrl",
  });
});
