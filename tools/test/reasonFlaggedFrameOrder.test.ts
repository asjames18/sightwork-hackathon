/** Reason step validator (validateReasonRequest) flagged-frame order: a direct
 * runReason caller bypassing the segment step gets the same fail-fast as the
 * segment step's own indices — flaggedFrames are sorted, unique indices into
 * the frame list, so a duplicate would double-count a flagged frame and an
 * out-of-order list would misstate which frames SAM flagged first. Real runs
 * are already sorted and unique (the segment step sorts its set), so no
 * current run changes, and a strictly increasing list passes. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function input(flaggedFrames: number[]): ReasonInput {
  return {
    frames: [
      { tSec: 0, dataUrl: PNG_1PX },
      { tSec: 5, dataUrl: PNG_1PX },
      { tSec: 10, dataUrl: PNG_1PX },
    ],
    segmentation: { counts: [], flaggedFrames },
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

test("a duplicate flagged frame is rejected", () => {
  assert.throws(() => validateReasonRequest(input([0, 1, 1]), deps()), {
    message: "reason: segmentation.flaggedFrames[2] must be greater than the previous flagged frame",
  });
});

test("an out-of-order flagged frame is rejected", () => {
  assert.throws(() => validateReasonRequest(input([1, 0]), deps()), {
    message: "reason: segmentation.flaggedFrames[1] must be greater than the previous flagged frame",
  });
});

test("strictly increasing flagged frames pass", () => {
  assert.doesNotThrow(() => validateReasonRequest(input([0, 1, 2]), deps()));
  assert.doesNotThrow(() => validateReasonRequest(input([]), deps()));
});

test("a malformed flagged frame keeps its own message", () => {
  assert.throws(() => validateReasonRequest(input([1, -1]), deps()), {
    message: "reason: segmentation.flaggedFrames must be an array of integers >= 0",
  });
});

test("an out-of-range flagged frame keeps its own message", () => {
  assert.throws(() => validateReasonRequest(input([0, 3]), deps()), {
    message: "reason: segmentation.flaggedFrames[1] must refer to an existing frame",
  });
});
