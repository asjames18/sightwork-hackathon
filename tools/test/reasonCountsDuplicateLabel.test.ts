/** Reason step validator (validateReasonRequest) duplicate counts label: parity
 * with buildReasonPrompt, which already rejects a repeated segmentation
 * counts label (exact, case, or surrounding whitespace) instead of printing
 * it twice, where the model could add the two rows together and overstate
 * the inventory. A direct runReason caller with a prebuilt prompt bypasses
 * the prompt build, so the validator gets the same fail-fast here, before
 * any paid Spark call. Real runs are already unique (the segment step
 * emits one row per label), so no current run changes, and distinct labels
 * pass. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

type Count = { label: string; count: number; confidence: number };

function input(counts: Count[]): ReasonInput {
  return {
    frames: [
      { tSec: 0, dataUrl: PNG_1PX },
      { tSec: 5, dataUrl: PNG_1PX },
      { tSec: 10, dataUrl: PNG_1PX },
    ],
    segmentation: { counts, flaggedFrames: [] },
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

test("an exact duplicate counts label is rejected", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { label: "Padded chairs", count: 5, confidence: 0.9 },
          { label: "Padded chairs", count: 3, confidence: 0.8 },
        ]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[1].label must be unique",
    },
  );
});

test("a duplicate counts label at a later index names that index", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { label: "Padded chairs", count: 5, confidence: 0.9 },
          { label: "Choir chairs", count: 2, confidence: 0.8 },
          { label: "Choir chairs", count: 1, confidence: 0.7 },
        ]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[2].label must be unique",
    },
  );
});

test("a counts label repeated apart from case or whitespace is rejected", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { label: "Padded chairs", count: 5, confidence: 0.9 },
          { label: "  padded chairs ", count: 3, confidence: 0.8 },
        ]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[1].label must be unique",
    },
  );
});

test("distinct counts labels pass", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(
      input([
        { label: "Padded chairs", count: 5, confidence: 0.9 },
        { label: "Choir chairs", count: 2, confidence: 0.8 },
      ]),
      deps(),
    ),
  );
  assert.doesNotThrow(() => validateReasonRequest(input([]), deps()));
});

test("a malformed counts entry keeps its own message", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { label: "", count: 5, confidence: 0.9 },
          { label: "", count: 3, confidence: 0.8 },
        ]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[0] has no valid label/count/confidence",
    },
  );
});
