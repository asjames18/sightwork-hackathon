/**
 * buildReasonPrompt rejects a segmentation value that is an array
 * at all, instead of printing it verbatim as JSON: arrays are
 * objects in JavaScript, so the object check lets them through and
 * an empty array used to reach the model as "[]" (or a bare list
 * of counts) inside the SEGMENTATION section. The segment step
 * only produces a counts object ({ counts, flaggedFrames }).
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

describe("buildReasonPrompt segmentation must be an object, not an array", () => {
  test("rejects an empty array segmentation", () => {
    assert.throws(
      () => buildReasonPrompt(withSegmentation([])),
      /buildReasonPrompt: segmentation must be an object, not an array/,
    );
  });

  test("rejects an array of counts as the segmentation", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
          ]),
        ),
      /buildReasonPrompt: segmentation must be an object, not an array/,
    );
  });

  test("still builds a clean reason prompt", () => {
    const prompt = buildReasonPrompt(
      withSegmentation({
        counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
        flaggedFrames: [],
      }),
    );
    assert.ok(prompt.includes('"count":5'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("a null segmentation still builds the no-data prompt", () => {
    const prompt = buildReasonPrompt(withSegmentation(null));
    assert.ok(prompt.includes("(no segmentation data"));
  });
});
