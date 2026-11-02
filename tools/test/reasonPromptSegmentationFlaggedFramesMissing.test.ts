/**
 * buildReasonPrompt rejects a non-null segmentation with no
 * flaggedFrames field at all, instead of printing it verbatim as JSON
 * with no flagged frames while the template tells the model to look
 * hardest at flaggedFrames: the model then had no hazard frames to
 * look hardest at. SegmentationResult requires flaggedFrames, and
 * runReason's own validator already rejects a missing flaggedFrames
 * array before any paid call, so a direct buildReasonPrompt caller
 * gets the same fail-fast here. A flaggedFrames field that is present
 * but not an array is rejected the same way, and null segmentation
 * still builds the explicit no-data prompt.
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

describe("buildReasonPrompt segmentation missing flaggedFrames", () => {
  test("rejects a segmentation with no flaggedFrames field", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({
            counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
          }),
        ),
      /buildReasonPrompt: segmentation\.flaggedFrames must be an array/,
    );
  });

  test("rejects a segmentation with flaggedFrames explicitly undefined", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({
            counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
            flaggedFrames: undefined,
          }),
        ),
      /buildReasonPrompt: segmentation\.flaggedFrames must be an array/,
    );
  });

  test("still rejects a non-array flaggedFrames field, naming the field", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({
            counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
            flaggedFrames: 3,
          }),
        ),
      /buildReasonPrompt: segmentation\.flaggedFrames must be an array/,
    );
  });

  test("still builds a clean reason prompt with flagged frames", () => {
    const prompt = buildReasonPrompt(base);
    assert.ok(prompt.includes('"flaggedFrames":[]'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still builds a clean reason prompt without segmentation", () => {
    const prompt = buildReasonPrompt({ ...base, segmentation: null });
    assert.ok(prompt.includes("(no segmentation data"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
