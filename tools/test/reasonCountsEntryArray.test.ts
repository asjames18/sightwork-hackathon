/** Reason step validator (validateReasonRequest) counts-entry array:
 * parity with buildReasonPrompt, which already rejects a counts entry
 * that is an array at all, since arrays are objects in JavaScript and
 * the per-field guards read label, count and confidence straight off
 * the array — an entry carrying those fields as array properties
 * passed every check, yet JSON.stringify drops array properties and
 * it would print as an empty "[]" with its count silently lost. A
 * direct runReason caller with a prebuilt prompt bypasses the prompt
 * build, so the validator gets the same fail-fast here, before any
 * paid Spark call. Real runs are already clean (the segment step
 * emits plain objects), so no current run changes, and plain objects
 * pass. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

type Count = { label: string; count: number; confidence: number };

function input(counts: unknown[]): ReasonInput {
  return {
    frames: [
      { tSec: 0, dataUrl: PNG_1PX },
      { tSec: 5, dataUrl: PNG_1PX },
      { tSec: 10, dataUrl: PNG_1PX },
    ],
    segmentation: { counts, flaggedFrames: [] } as ReasonInput["segmentation"],
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

function propsArray(): unknown {
  const entry: unknown[] & Partial<Count> = [];
  entry.label = "Padded chairs";
  entry.count = 5;
  entry.confidence = 0.9;
  return entry;
}

test("a counts entry carrying its fields as array properties is rejected", () => {
  assert.throws(
    () =>
      validateReasonRequest(input([propsArray()]), deps()),
    {
      message:
        "reason: segmentation.counts[0] must be an object, not an array",
    },
  );
});

test("an array counts entry at a later index names that index", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { label: "Padded chairs", count: 5, confidence: 0.9 },
          propsArray(),
        ]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[1] must be an object, not an array",
    },
  );
});

test("a plain array counts entry is rejected with the named error", () => {
  assert.throws(
    () => validateReasonRequest(input([[]]), deps()),
    {
      message:
        "reason: segmentation.counts[0] must be an object, not an array",
    },
  );
});

test("plain object counts entries pass", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(
      input([{ label: "Padded chairs", count: 5, confidence: 0.9 }]),
      deps(),
    ),
  );
  assert.doesNotThrow(() => validateReasonRequest(input([]), deps()));
});

test("a malformed non-array counts entry keeps its own message", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([{ label: "", count: 5, confidence: 0.9 }]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[0] has no valid label/count/confidence",
    },
  );
});
