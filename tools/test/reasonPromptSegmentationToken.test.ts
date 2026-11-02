/**
 * buildReasonPrompt rejects a {{...}} token anywhere in the
 * segmentation object that the per-field guards do not cover,
 * instead of expanding it with the later transcript fill: the
 * whole segmentation object is printed verbatim as JSON, so a
 * token in an extra field on a counts entry (or an extra
 * top-level field) used to print the whole transcript inside the
 * SEGMENTATION section. A token in a label still throws the
 * label error first.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReasonPrompt } from "@/lib/pipeline/planPrompts";
import type { ReasonInput } from "@/lib/pipeline/reason";

const base: ReasonInput = {
  frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,xxxx" }],
  segmentation: {
    counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
    flaggedFrames: [],
  },
  transcript: "Hello transcript.",
  spaceName: "Sanctuary",
  spaceType: "church sanctuary",
  durationSec: 60,
};

function withSegmentation(segmentation: unknown): ReasonInput {
  return {
    ...base,
    segmentation: segmentation as ReasonInput["segmentation"],
  };
}

describe("buildReasonPrompt segmentation must not contain a placeholder", () => {
  test("rejects a token in an extra counts-entry field", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({
            counts: [
              {
                label: "Padded chairs",
                count: 5,
                confidence: 0.9,
                zone: "stage {{transcript}}",
              },
            ],
            flaggedFrames: [],
          }),
        ),
      /buildReasonPrompt: segmentation must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a token in an extra top-level field", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({
            counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
            flaggedFrames: [],
            source: "sam {{transcript}}",
          }),
        ),
      /buildReasonPrompt: segmentation must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("a label token still throws the label error first", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({
            counts: [
              { label: "Chairs {{transcript}}", count: 5, confidence: 0.9 },
            ],
            flaggedFrames: [],
          }),
        ),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("still builds a clean reason prompt", () => {
    const prompt = buildReasonPrompt(
      withSegmentation({
        counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
        flaggedFrames: [],
      }),
    );
    assert.ok(prompt.includes('"label":"Padded chairs"'));
    assert.ok(prompt.includes('"count":5'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
