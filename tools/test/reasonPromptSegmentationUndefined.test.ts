/**
 * buildReasonPrompt rejects an undefined segmentation, instead of
 * building the explicit no-data prompt ("the segmentation step
 * failed") even though the segment step never ran and never failed
 * — the caller simply omitted the field, and the model counted from
 * the frames with no SAM floor and no warning that the floor was
 * missing rather than failed. ReasonInput requires segmentation (an
 * object or null, not optional), and runReason's own validator
 * already rejects an undefined segmentation before any paid call, so
 * a direct buildReasonPrompt caller gets the same fail-fast here. A
 * non-object segmentation is rejected the same way, and null
 * segmentation still builds the explicit no-data prompt.
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

describe("buildReasonPrompt segmentation undefined", () => {
  test("rejects an undefined segmentation", () => {
    assert.throws(
      () => buildReasonPrompt(withSegmentation(undefined)),
      /buildReasonPrompt: segmentation must be an object or null/,
    );
  });

  test("still rejects a non-object segmentation, naming the field", () => {
    assert.throws(
      () => buildReasonPrompt(withSegmentation("counts")),
      /buildReasonPrompt: segmentation must be an object or null/,
    );
  });

  test("still rejects an array segmentation, naming the field", () => {
    assert.throws(
      () => buildReasonPrompt(withSegmentation([])),
      /buildReasonPrompt: segmentation must be an object, not an array/,
    );
  });

  test("still builds a clean reason prompt with segmentation", () => {
    const prompt = buildReasonPrompt(base);
    assert.ok(prompt.includes('"flaggedFrames":[]'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still builds the no-data prompt with null segmentation", () => {
    const prompt = buildReasonPrompt({ ...base, segmentation: null });
    assert.ok(prompt.includes("(no segmentation data"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
