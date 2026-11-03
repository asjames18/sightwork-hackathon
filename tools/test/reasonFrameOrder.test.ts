/** Reason step validator (validateReasonRequest) frame order: a direct
 * runReason caller bypassing the route validator gets the same
 * fail-fast as the route's frames — the reason frame list rides into
 * the prompt in array order, so an out-of-order frame would mislabel
 * what was seen when against the transcript's said-vs-saw alignment.
 * Real runs are already ordered (runPlan hands the reason step the
 * route-validated frames in order), so no current run changes, and
 * equal tSec passes like the route's frames. No network. */
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

test("an out-of-order frame is rejected", () => {
  assert.throws(() => validateReasonRequest(input([5, 2]), deps()), {
    message: "reason: frame 1 tSec must not be earlier than the previous frame",
  });
});

test("in-order frames and equal tSec pass", () => {
  assert.doesNotThrow(() => validateReasonRequest(input([0, 2, 5]), deps()));
  assert.doesNotThrow(() => validateReasonRequest(input([2, 2]), deps()));
});

test("a malformed frame keeps its own message", () => {
  assert.throws(() => validateReasonRequest(input([5, -1]), deps()), {
    message: "reason: frame 1 has no valid tSec/dataUrl",
  });
});
