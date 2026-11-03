/** Reason step validator (validateReasonRequest) flagged-frame range: a direct
 * runReason caller bypassing the segment step gets the same fail-fast as the
 * segment step's own indices — flaggedFrames are sorted, unique indices into
 * the frame list, so an index at or past frames.length names a frame that
 * does not exist and the prompt would claim SAM flagged it. Real runs are
 * already in range (the segment step flags only frames it was given), so no
 * current run changes, and the last valid index passes. No network. */
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

test("a flagged frame past the frame list is rejected", () => {
  assert.throws(() => validateReasonRequest(input([0, 2]), deps()), {
    message: "reason: segmentation.flaggedFrames[1] must refer to an existing frame",
  });
});

test("flagged frames inside the frame list pass", () => {
  assert.doesNotThrow(() => validateReasonRequest(input([0, 1]), deps()));
  assert.doesNotThrow(() => validateReasonRequest(input([]), deps()));
});

test("a malformed flagged frame keeps its own message", () => {
  assert.throws(() => validateReasonRequest(input([2, -1]), deps()), {
    message: "reason: segmentation.flaggedFrames must be an array of integers >= 0",
  });
});
