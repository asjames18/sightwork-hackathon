/** Reason step validator (validateReasonRequest) segmentation array:
 * parity with buildReasonPrompt, which already rejects a segmentation
 * value that is an array at all, since arrays are objects in
 * JavaScript and the object check lets them through — so an array
 * segmentation used to draw the generic "counts must be an array"
 * message here (an array has no counts property), hiding that the
 * whole segmentation value was the wrong shape. A direct runReason
 * caller with a prebuilt prompt bypasses the prompt build, so the
 * validator gets the same named fail-fast here, before any paid
 * Spark call. Real runs are already clean (the segment step emits
 * a plain object), so no current run changes, and plain objects,
 * null, and an object without counts keep their own messages. No
 * network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function input(segmentation: unknown): ReasonInput {
  return {
    frames: [
      { tSec: 0, dataUrl: PNG_1PX },
      { tSec: 5, dataUrl: PNG_1PX },
      { tSec: 10, dataUrl: PNG_1PX },
    ],
    segmentation: segmentation as ReasonInput["segmentation"],
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

test("an empty array segmentation is rejected with the named error", () => {
  assert.throws(
    () => validateReasonRequest(input([]), deps()),
    {
      message: "reason: segmentation must be an object, not an array",
    },
  );
});

test("an array of counts as the segmentation is rejected with the named error", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([{ label: "Padded chairs", count: 5, confidence: 0.9 }]),
        deps(),
      ),
    {
      message: "reason: segmentation must be an object, not an array",
    },
  );
});

test("plain object and null segmentations pass", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(
      input({
        counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
        flaggedFrames: [],
      }),
      deps(),
    ),
  );
  assert.doesNotThrow(() => validateReasonRequest(input(null), deps()));
  assert.doesNotThrow(() =>
    validateReasonRequest(input({ counts: [], flaggedFrames: [] }), deps()),
  );
});

test("a non-object segmentation keeps its own message", () => {
  assert.throws(
    () => validateReasonRequest(input("nope"), deps()),
    {
      message: "reason: segmentation must be an object or null",
    },
  );
});

test("an object segmentation without counts keeps the counts message", () => {
  assert.throws(
    () => validateReasonRequest(input({}), deps()),
    {
      message: "reason: segmentation.counts must be an array",
    },
  );
});
