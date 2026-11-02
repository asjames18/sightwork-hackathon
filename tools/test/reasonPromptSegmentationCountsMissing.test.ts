/**
 * buildReasonPrompt rejects a non-null segmentation with no counts
 * field at all, instead of printing it verbatim as JSON with no
 * counts while the template tells the model the segmentation counts
 * are the inventory floor: the model could then invent its own
 * counts with nothing to floor them against. SegmentationResult
 * requires counts, and runReason's own validator already rejects a
 * missing counts array before any paid call, so a direct
 * buildReasonPrompt caller gets the same fail-fast here. A counts
 * field that is present but not an array is rejected the same way,
 * and null segmentation still builds the explicit no-data prompt.
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

describe("buildReasonPrompt segmentation missing counts", () => {
  test("rejects a segmentation with no counts field", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({ flaggedFrames: [] }),
        ),
      /buildReasonPrompt: segmentation\.counts must be an array/,
    );
  });

  test("rejects a segmentation with counts explicitly undefined", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({ counts: undefined, flaggedFrames: [] }),
        ),
      /buildReasonPrompt: segmentation\.counts must be an array/,
    );
  });

  test("still rejects a non-array counts field, naming the field", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({
            counts: "Padded chairs",
            flaggedFrames: [],
          }),
        ),
      /buildReasonPrompt: segmentation\.counts must be an array/,
    );
  });

  test("still builds with an empty counts array", () => {
    const prompt = buildReasonPrompt(
      withSegmentation({ counts: [], flaggedFrames: [] }),
    );
    assert.ok(prompt.includes('"counts":[]'));
  });

  test("still builds a clean prompt with one count", () => {
    const prompt = buildReasonPrompt(
      withSegmentation({
        counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
        flaggedFrames: [],
      }),
    );
    assert.ok(prompt.includes('"label":"Padded chairs"'));
  });

  test("still builds the no-data prompt with null segmentation", () => {
    const prompt = buildReasonPrompt(withSegmentation(null));
    assert.ok(prompt.includes("(no segmentation data"));
  });
});
