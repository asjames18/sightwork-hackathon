/** Reason step validator (validateReasonRequest) counts-label placeholder:
 * parity with buildReasonPrompt, which already rejects a {{...}}
 * placeholder in a segmentation counts label, since the prompt template
 * fills {{...}} slots itself and a label carrying one would print as an
 * unfilled slot in the finished prompt. A direct runReason caller with
 * a prebuilt prompt bypasses the prompt build, so the validator gets
 * the same fail-fast here, before any paid Spark call. Real runs are
 * already clean (the segment step emits plain labels), so no current
 * run changes, and plain labels pass. No network. */
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

test("a counts label that is a placeholder is rejected", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([{ label: "{{chairs}}", count: 5, confidence: 0.9 }]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[0].label must not contain a {{...}} placeholder",
    },
  );
});

test("a placeholder inside a counts label names that index", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { label: "Padded chairs", count: 5, confidence: 0.9 },
          { label: "Choir {{chairs}}", count: 2, confidence: 0.8 },
        ]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[1].label must not contain a {{...}} placeholder",
    },
  );
});

test("plain counts labels pass", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(
      input([{ label: "Padded chairs", count: 5, confidence: 0.9 }]),
      deps(),
    ),
  );
  assert.doesNotThrow(() => validateReasonRequest(input([]), deps()));
});

test("a counts label with single braces passes", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(
      input([{ label: "{chairs}", count: 5, confidence: 0.9 }]),
      deps(),
    ),
  );
});

test("a malformed counts entry keeps its own message", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { label: "", count: 5, confidence: 0.9 },
          { label: "{{chairs}}", count: 3, confidence: 0.8 },
        ]),
        deps(),
      ),
    {
      message:
        "reason: segmentation.counts[0] has no valid label/count/confidence",
    },
  );
});
